"""Tests for the nearby-mosque endpoint and geo layer (F-02.1, FR-2.5)."""

import uuid
from unittest.mock import MagicMock, patch

import requests
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from core.geo import GeoProviderError, find_nearby_mosques
from core.geo.distance import haversine_m

# A real-ish Geoapify-style mosque ~150 m and ~600 m from the query point. The
# features arrive out of distance order to prove the endpoint sorts them.
QUERY_LAT, QUERY_LNG = 23.7806, 90.4070


def _feature(place_id, name, lat, lon):
    return {
        "type": "Feature",
        "properties": {"place_id": place_id, "name": name, "lat": lat, "lon": lon},
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
    }


def _fake_geoapify(features):
    """Build a MagicMock standing in for ``requests.get`` returning ``features``."""
    response = MagicMock()
    response.raise_for_status.return_value = None
    response.json.return_value = {"type": "FeatureCollection", "features": features}
    return MagicMock(return_value=response)


class HaversineTests(APITestCase):
    def test_zero_distance_for_same_point(self):
        self.assertEqual(haversine_m(QUERY_LAT, QUERY_LNG, QUERY_LAT, QUERY_LNG), 0.0)

    def test_known_distance_one_degree_latitude(self):
        # One degree of latitude is ~111 km anywhere on Earth.
        d = haversine_m(0.0, 0.0, 1.0, 0.0)
        self.assertAlmostEqual(d, 111_195, delta=200)


@override_settings(GEOAPIFY_API_KEY="test-key")
class FindNearbyMosquesTests(APITestCase):
    def test_parses_and_sorts_by_distance(self):
        features = [
            _feature("far", "Far Mosque", 23.7860, 90.4070),  # ~600 m north
            _feature("near", "Near Mosque", 23.7819, 90.4070),  # ~145 m north
        ]
        with patch("core.geo.geoapify.requests.get", _fake_geoapify(features)):
            results = find_nearby_mosques(QUERY_LAT, QUERY_LNG, 1000)

        self.assertEqual([m.external_id for m in results], ["near", "far"])
        self.assertLess(results[0].distance_m, results[1].distance_m)
        self.assertEqual(results[0].source, "geoapify")

    def test_sends_geoapify_params_with_lon_lat_order_and_limit(self):
        fake = _fake_geoapify([])
        with patch("core.geo.geoapify.requests.get", fake):
            find_nearby_mosques(QUERY_LAT, QUERY_LNG, 300)

        params = fake.call_args.kwargs["params"]
        self.assertEqual(params["categories"], "religion.place_of_worship.islam")
        # circle:LON,LAT,RADIUS — longitude must come first.
        self.assertEqual(params["filter"], f"circle:{QUERY_LNG},{QUERY_LAT},300")
        self.assertEqual(params["bias"], f"proximity:{QUERY_LNG},{QUERY_LAT}")
        self.assertEqual(params["limit"], 100)
        self.assertEqual(params["apiKey"], "test-key")

    def test_skips_features_without_coordinates_or_id(self):
        features = [
            {"properties": {"place_id": "no-coords", "name": "Nowhere"}},
            {"properties": {"name": "No id", "lat": 23.78, "lon": 90.40}},
            _feature("ok", "Good Mosque", 23.7819, 90.4070),
        ]
        with patch("core.geo.geoapify.requests.get", _fake_geoapify(features)):
            results = find_nearby_mosques(QUERY_LAT, QUERY_LNG, 1000)

        self.assertEqual([m.external_id for m in results], ["ok"])

    def test_timeout_raises_geo_provider_error(self):
        with patch("core.geo.geoapify.requests.get", side_effect=requests.Timeout):
            with self.assertRaises(GeoProviderError):
                find_nearby_mosques(QUERY_LAT, QUERY_LNG, 300)

    @override_settings(GEOAPIFY_API_KEY="")
    def test_missing_api_key_raises_geo_provider_error(self):
        with self.assertRaises(GeoProviderError):
            find_nearby_mosques(QUERY_LAT, QUERY_LNG, 300)


@override_settings(GEOAPIFY_API_KEY="test-key")
class MosquesEndpointTests(APITestCase):
    def _get(self, **params):
        return self.client.get("/mosques", params)

    def test_returns_sorted_mosques_with_name_and_distance(self):
        features = [
            _feature("far", "Far Mosque", 23.7860, 90.4070),
            _feature("near", "Near Mosque", 23.7819, 90.4070),
        ]
        with patch("core.geo.geoapify.requests.get", _fake_geoapify(features)):
            response = self._get(lat=QUERY_LAT, lng=QUERY_LNG, radius_m=1000)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body["count"], 2)
        names = [m["name"] for m in body["mosques"]]
        self.assertEqual(names, ["Near Mosque", "Far Mosque"])
        first = body["mosques"][0]
        self.assertIn("distance_m", first)
        self.assertLessEqual(
            first["distance_m"], body["mosques"][1]["distance_m"]
        )

    def test_exposes_opaque_id_and_hides_provider_fields(self):
        features = [_feature("place-123", "Near Mosque", 23.7819, 90.4070)]
        with patch("core.geo.geoapify.requests.get", _fake_geoapify(features)):
            response = self._get(lat=QUERY_LAT, lng=QUERY_LNG)

        mosque = response.json()["mosques"][0]
        self.assertEqual(set(mosque), {"id", "name", "lat", "lng", "distance_m"})
        # Opaque id: a UUID, not the provider's raw place id.
        self.assertEqual(str(uuid.UUID(mosque["id"])), mosque["id"])
        self.assertNotIn("place-123", response.content.decode())
        self.assertNotIn("geoapify", response.content.decode())

    def test_id_is_stable_across_requests(self):
        features = [_feature("place-123", "Near Mosque", 23.7819, 90.4070)]
        with patch("core.geo.geoapify.requests.get", _fake_geoapify(features)):
            first = self._get(lat=QUERY_LAT, lng=QUERY_LNG).json()["mosques"][0]["id"]
        with patch("core.geo.geoapify.requests.get", _fake_geoapify(features)):
            second = self._get(lat=QUERY_LAT, lng=QUERY_LNG).json()["mosques"][0]["id"]
        self.assertEqual(first, second)

    def test_missing_lat_or_lng_is_400(self):
        self.assertEqual(self._get(lng=QUERY_LNG).status_code, 400)
        self.assertEqual(self._get(lat=QUERY_LAT).status_code, 400)

    def test_non_numeric_coord_is_400(self):
        self.assertEqual(self._get(lat="abc", lng=QUERY_LNG).status_code, 400)

    def test_out_of_range_coord_is_400(self):
        self.assertEqual(self._get(lat=120, lng=QUERY_LNG).status_code, 400)
        self.assertEqual(self._get(lat=QUERY_LAT, lng=200).status_code, 400)

    def test_radius_defaults_to_300_when_omitted(self):
        with patch("core.geo.geoapify.requests.get", _fake_geoapify([])):
            response = self._get(lat=QUERY_LAT, lng=QUERY_LNG)
        self.assertEqual(response.json()["radius_m"], 300)

    def test_radius_clamped_to_max_5000(self):
        fake = _fake_geoapify([])
        with patch("core.geo.geoapify.requests.get", fake):
            response = self._get(lat=QUERY_LAT, lng=QUERY_LNG, radius_m=99999)
        self.assertEqual(response.json()["radius_m"], 5000)
        # The clamped value is what actually reaches Geoapify.
        self.assertEqual(
            fake.call_args.kwargs["params"]["filter"],
            f"circle:{QUERY_LNG},{QUERY_LAT},5000",
        )

    def test_non_positive_radius_is_400(self):
        self.assertEqual(
            self._get(lat=QUERY_LAT, lng=QUERY_LNG, radius_m=0).status_code, 400
        )

    def test_provider_failure_is_502_not_500(self):
        with patch("core.geo.geoapify.requests.get", side_effect=requests.Timeout):
            response = self._get(lat=QUERY_LAT, lng=QUERY_LNG)
        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)

    def test_api_key_never_appears_in_response(self):
        with patch("core.geo.geoapify.requests.get", _fake_geoapify([])):
            response = self._get(lat=QUERY_LAT, lng=QUERY_LNG)
        self.assertNotIn("test-key", response.content.decode())
