"""Tests for the nearby-mosque endpoint and geo layer (F-02.1, F-02.2)."""

import uuid
from unittest.mock import MagicMock, patch

import requests
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from core.geo import GeoProviderError, Mosque, MosqueProvider, find_nearby_mosques
from core.geo.distance import haversine_m
from core.geo.geoapify import GeoapifyProvider
from core.geo.overpass import OverpassProvider

QUERY_LAT, QUERY_LNG = 23.7806, 90.4070


def _mosque(external_id, name, distance_m, source="geoapify", lat=QUERY_LAT, lng=QUERY_LNG):
    return Mosque(
        external_id=external_id,
        name=name,
        lat=lat,
        lng=lng,
        distance_m=distance_m,
        source=source,
    )


class HaversineTests(APITestCase):
    def test_zero_distance_for_same_point(self):
        self.assertEqual(haversine_m(QUERY_LAT, QUERY_LNG, QUERY_LAT, QUERY_LNG), 0.0)

    def test_known_distance_one_degree_latitude(self):
        # One degree of latitude is ~111 km anywhere on Earth.
        d = haversine_m(0.0, 0.0, 1.0, 0.0)
        self.assertAlmostEqual(d, 111_195, delta=200)


class MosquePublicIdTests(APITestCase):
    def test_public_id_is_stable_and_hides_provider(self):
        m = _mosque("place-123", "Near Mosque", 145.0)
        again = _mosque("place-123", "Near Mosque", 999.0)  # distance irrelevant
        self.assertEqual(m.public_id, again.public_id)
        self.assertEqual(str(uuid.UUID(m.public_id)), m.public_id)

    def test_public_id_differs_by_source(self):
        geo = _mosque("123", "X", 1.0, source="geoapify")
        osm = _mosque("123", "X", 1.0, source="overpass")
        self.assertNotEqual(geo.public_id, osm.public_id)


# --------------------------------------------------------------------------- #
# Geoapify provider (primary)
# --------------------------------------------------------------------------- #
def _geoapify_feature(place_id, name, lat, lon):
    return {
        "type": "Feature",
        "properties": {"place_id": place_id, "name": name, "lat": lat, "lon": lon},
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
    }


def _fake_get(features):
    response = MagicMock()
    response.raise_for_status.return_value = None
    response.json.return_value = {"type": "FeatureCollection", "features": features}
    return MagicMock(return_value=response)


@override_settings(GEOAPIFY_API_KEY="test-key")
class GeoapifyProviderTests(APITestCase):
    def test_parses_features(self):
        features = [_geoapify_feature("near", "Near Mosque", 23.7819, 90.4070)]
        with patch("core.geo.geoapify.requests.get", _fake_get(features)):
            results = GeoapifyProvider().find_nearby(QUERY_LAT, QUERY_LNG, 1000)

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].external_id, "near")
        self.assertEqual(results[0].source, "geoapify")
        self.assertGreater(results[0].distance_m, 0)

    def test_sends_lon_lat_circle_and_limit(self):
        fake = _fake_get([])
        with patch("core.geo.geoapify.requests.get", fake):
            GeoapifyProvider().find_nearby(QUERY_LAT, QUERY_LNG, 300)

        params = fake.call_args.kwargs["params"]
        self.assertEqual(params["categories"], "religion.place_of_worship.islam")
        # circle:LON,LAT,RADIUS — longitude first.
        self.assertEqual(params["filter"], f"circle:{QUERY_LNG},{QUERY_LAT},300")
        self.assertEqual(params["bias"], f"proximity:{QUERY_LNG},{QUERY_LAT}")
        self.assertEqual(params["limit"], 100)
        self.assertEqual(params["apiKey"], "test-key")

    def test_skips_unmappable_features(self):
        features = [
            {"properties": {"place_id": "no-coords", "name": "Nowhere"}},
            {"properties": {"name": "No id", "lat": 23.78, "lon": 90.40}},
            _geoapify_feature("ok", "Good Mosque", 23.7819, 90.4070),
        ]
        with patch("core.geo.geoapify.requests.get", _fake_get(features)):
            results = GeoapifyProvider().find_nearby(QUERY_LAT, QUERY_LNG, 1000)
        self.assertEqual([m.external_id for m in results], ["ok"])

    def test_timeout_raises_geo_provider_error(self):
        with patch("core.geo.geoapify.requests.get", side_effect=requests.Timeout):
            with self.assertRaises(GeoProviderError):
                GeoapifyProvider().find_nearby(QUERY_LAT, QUERY_LNG, 300)

    @override_settings(GEOAPIFY_API_KEY="")
    def test_missing_api_key_raises_geo_provider_error(self):
        with self.assertRaises(GeoProviderError):
            GeoapifyProvider().find_nearby(QUERY_LAT, QUERY_LNG, 300)


# --------------------------------------------------------------------------- #
# Overpass provider (fallback)
# --------------------------------------------------------------------------- #
def _fake_post(elements):
    response = MagicMock()
    response.raise_for_status.return_value = None
    response.json.return_value = {"elements": elements}
    return MagicMock(return_value=response)


class OverpassProviderTests(APITestCase):
    def test_parses_node_and_way_center(self):
        elements = [
            {"type": "node", "id": 1, "lat": 23.7819, "lon": 90.4070, "tags": {"name": "Node Mosque"}},
            {"type": "way", "id": 2, "center": {"lat": 23.7860, "lon": 90.4070}, "tags": {"name": "Way Mosque"}},
        ]
        with patch("core.geo.overpass.requests.post", _fake_post(elements)):
            results = OverpassProvider().find_nearby(QUERY_LAT, QUERY_LNG, 1000)

        self.assertEqual({m.external_id for m in results}, {"node/1", "way/2"})
        self.assertTrue(all(m.source == "overpass" for m in results))

    def test_sends_around_radius_lat_lng(self):
        fake = _fake_post([])
        with patch("core.geo.overpass.requests.post", fake):
            OverpassProvider().find_nearby(QUERY_LAT, QUERY_LNG, 300)

        query = fake.call_args.kwargs["data"]
        # Overpass around: is radius,LAT,LON — lat first (opposite of Geoapify).
        self.assertIn(f"around:300,{QUERY_LAT},{QUERY_LNG}", query)
        self.assertIn('"religion"="muslim"', query)

    def test_skips_elements_without_coordinates(self):
        elements = [
            {"type": "relation", "id": 9, "tags": {"name": "No center"}},
            {"type": "node", "id": 1, "lat": 23.7819, "lon": 90.4070, "tags": {}},
        ]
        with patch("core.geo.overpass.requests.post", _fake_post(elements)):
            results = OverpassProvider().find_nearby(QUERY_LAT, QUERY_LNG, 1000)
        self.assertEqual([m.external_id for m in results], ["node/1"])

    def test_failure_raises_geo_provider_error(self):
        with patch("core.geo.overpass.requests.post", side_effect=requests.ConnectionError):
            with self.assertRaises(GeoProviderError):
                OverpassProvider().find_nearby(QUERY_LAT, QUERY_LNG, 300)


# --------------------------------------------------------------------------- #
# Provider chain orchestration (the geo abstraction, F-02.2)
# --------------------------------------------------------------------------- #
class _StubProvider(MosqueProvider):
    def __init__(self, name, result=None, error=None):
        self.name = name
        self._result = result or []
        self._error = error
        self.called = False

    def find_nearby(self, lat, lng, radius_m):
        self.called = True
        if self._error is not None:
            raise self._error
        return list(self._result)


class ProviderChainTests(APITestCase):
    def test_primary_success_skips_fallback(self):
        primary = _StubProvider("primary", result=[_mosque("a", "A", 10.0)])
        fallback = _StubProvider("fallback", result=[_mosque("b", "B", 5.0)])
        results = find_nearby_mosques(QUERY_LAT, QUERY_LNG, 300, providers=[primary, fallback])

        self.assertEqual([m.external_id for m in results], ["a"])
        self.assertTrue(primary.called)
        self.assertFalse(fallback.called)

    def test_falls_back_when_primary_errors(self):
        primary = _StubProvider("primary", error=GeoProviderError("down"))
        fallback = _StubProvider("fallback", result=[_mosque("b", "B", 5.0)])
        results = find_nearby_mosques(QUERY_LAT, QUERY_LNG, 300, providers=[primary, fallback])

        self.assertEqual([m.external_id for m in results], ["b"])
        self.assertTrue(fallback.called)

    def test_empty_success_does_not_fall_back(self):
        primary = _StubProvider("primary", result=[])
        fallback = _StubProvider("fallback", result=[_mosque("b", "B", 5.0)])
        results = find_nearby_mosques(QUERY_LAT, QUERY_LNG, 300, providers=[primary, fallback])

        self.assertEqual(results, [])
        self.assertFalse(fallback.called)

    def test_all_providers_failing_raises(self):
        primary = _StubProvider("primary", error=GeoProviderError("down"))
        fallback = _StubProvider("fallback", error=GeoProviderError("also down"))
        with self.assertRaises(GeoProviderError):
            find_nearby_mosques(QUERY_LAT, QUERY_LNG, 300, providers=[primary, fallback])

    def test_results_sorted_by_distance(self):
        provider = _StubProvider(
            "p", result=[_mosque("far", "Far", 600.0), _mosque("near", "Near", 145.0)]
        )
        results = find_nearby_mosques(QUERY_LAT, QUERY_LNG, 300, providers=[provider])
        self.assertEqual([m.external_id for m in results], ["near", "far"])


# --------------------------------------------------------------------------- #
# Endpoint — exercises the view's validation/serialization over a mocked seam.
# --------------------------------------------------------------------------- #
class MosquesEndpointTests(APITestCase):
    def _get(self, **params):
        return self.client.get("/mosques", params)

    def _patch_seam(self, **kwargs):
        # The view does `from .geo import find_nearby_mosques`, so patch the name
        # bound in core.views, not the source module.
        return patch("core.views.find_nearby_mosques", **kwargs)

    def test_returns_sorted_mosques_with_name_and_distance(self):
        ordered = [_mosque("near", "Near Mosque", 145.0), _mosque("far", "Far Mosque", 600.0)]
        with self._patch_seam(return_value=ordered):
            response = self._get(lat=QUERY_LAT, lng=QUERY_LNG, radius_m=1000)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body["count"], 2)
        self.assertEqual([m["name"] for m in body["mosques"]], ["Near Mosque", "Far Mosque"])
        self.assertLessEqual(body["mosques"][0]["distance_m"], body["mosques"][1]["distance_m"])

    def test_exposes_opaque_id_and_hides_provider_fields(self):
        with self._patch_seam(return_value=[_mosque("place-123", "Near Mosque", 145.0)]):
            response = self._get(lat=QUERY_LAT, lng=QUERY_LNG)

        mosque = response.json()["mosques"][0]
        self.assertEqual(set(mosque), {"id", "name", "lat", "lng", "distance_m"})
        self.assertEqual(str(uuid.UUID(mosque["id"])), mosque["id"])
        self.assertNotIn("place-123", response.content.decode())
        self.assertNotIn("geoapify", response.content.decode())

    def test_missing_lat_or_lng_is_400(self):
        self.assertEqual(self._get(lng=QUERY_LNG).status_code, 400)
        self.assertEqual(self._get(lat=QUERY_LAT).status_code, 400)

    def test_non_numeric_coord_is_400(self):
        self.assertEqual(self._get(lat="abc", lng=QUERY_LNG).status_code, 400)

    def test_out_of_range_coord_is_400(self):
        self.assertEqual(self._get(lat=120, lng=QUERY_LNG).status_code, 400)
        self.assertEqual(self._get(lat=QUERY_LAT, lng=200).status_code, 400)

    def test_radius_defaults_to_300_when_omitted(self):
        with self._patch_seam(return_value=[]) as seam:
            response = self._get(lat=QUERY_LAT, lng=QUERY_LNG)
        self.assertEqual(response.json()["radius_m"], 300)
        self.assertEqual(seam.call_args.args[2], 300)

    def test_radius_clamped_to_max_5000(self):
        with self._patch_seam(return_value=[]) as seam:
            response = self._get(lat=QUERY_LAT, lng=QUERY_LNG, radius_m=99999)
        self.assertEqual(response.json()["radius_m"], 5000)
        # The clamped value is what reaches the geo layer.
        self.assertEqual(seam.call_args.args[2], 5000)

    def test_non_positive_radius_is_400(self):
        self.assertEqual(self._get(lat=QUERY_LAT, lng=QUERY_LNG, radius_m=0).status_code, 400)

    def test_all_providers_down_is_502_not_500(self):
        with self._patch_seam(side_effect=GeoProviderError("all down")):
            response = self._get(lat=QUERY_LAT, lng=QUERY_LNG)
        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
