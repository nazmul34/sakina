"""Tests for the nearby-mosque endpoint and geo layer (F-02.1, F-02.2, F-02.8)."""

import uuid
from datetime import timedelta
from unittest.mock import MagicMock, patch

import requests
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from core.geo import (
    GeoProviderError,
    Mosque,
    MosqueProvider,
    fetch_from_providers,
    find_nearby_mosques,
    invalidate_tile_at,
)
from core.geo.distance import haversine_m
from core.geo.geoapify import GeoapifyProvider
from core.geo.overpass import OverpassProvider
from core.geo.tiles import snap_to_tile
from core.models import FetchedTile
from core.models import Mosque as MosqueRecord

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
        results = fetch_from_providers(QUERY_LAT, QUERY_LNG, 300, providers=[primary, fallback])

        self.assertEqual([m.external_id for m in results], ["a"])
        self.assertTrue(primary.called)
        self.assertFalse(fallback.called)

    def test_falls_back_when_primary_errors(self):
        primary = _StubProvider("primary", error=GeoProviderError("down"))
        fallback = _StubProvider("fallback", result=[_mosque("b", "B", 5.0)])
        results = fetch_from_providers(QUERY_LAT, QUERY_LNG, 300, providers=[primary, fallback])

        self.assertEqual([m.external_id for m in results], ["b"])
        self.assertTrue(fallback.called)

    def test_empty_success_does_not_fall_back(self):
        primary = _StubProvider("primary", result=[])
        fallback = _StubProvider("fallback", result=[_mosque("b", "B", 5.0)])
        results = fetch_from_providers(QUERY_LAT, QUERY_LNG, 300, providers=[primary, fallback])

        self.assertEqual(results, [])
        self.assertFalse(fallback.called)

    def test_all_providers_failing_raises(self):
        primary = _StubProvider("primary", error=GeoProviderError("down"))
        fallback = _StubProvider("fallback", error=GeoProviderError("also down"))
        with self.assertRaises(GeoProviderError):
            fetch_from_providers(QUERY_LAT, QUERY_LNG, 300, providers=[primary, fallback])

    def test_results_sorted_by_distance(self):
        provider = _StubProvider(
            "p", result=[_mosque("far", "Far", 600.0), _mosque("near", "Near", 145.0)]
        )
        results = fetch_from_providers(QUERY_LAT, QUERY_LNG, 300, providers=[provider])
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

    @override_settings(MOSQUE_SEARCH_RADIUS_M=5000)
    def test_uses_server_fixed_radius(self):
        # FR-2.1: radius comes from the server setting, not the client, and is echoed.
        with self._patch_seam(return_value=[]) as seam:
            response = self._get(lat=QUERY_LAT, lng=QUERY_LNG)
        self.assertEqual(response.json()["radius_m"], 5000)
        self.assertEqual(seam.call_args.args[2], 5000)

    @override_settings(MOSQUE_SEARCH_RADIUS_M=5000)
    def test_client_radius_param_is_ignored(self):
        # The client can't widen/narrow the search: any radius_m is ignored.
        with self._patch_seam(return_value=[]) as seam:
            response = self._get(lat=QUERY_LAT, lng=QUERY_LNG, radius_m=99999)
        self.assertEqual(response.json()["radius_m"], 5000)
        self.assertEqual(seam.call_args.args[2], 5000)

    @override_settings(MOSQUE_SEARCH_RADIUS_M=1234)
    def test_radius_configurable_via_setting(self):
        with self._patch_seam(return_value=[]) as seam:
            response = self._get(lat=QUERY_LAT, lng=QUERY_LNG)
        self.assertEqual(response.json()["radius_m"], 1234)
        self.assertEqual(seam.call_args.args[2], 1234)

    def test_all_providers_down_is_502_not_500(self):
        with self._patch_seam(side_effect=GeoProviderError("all down")):
            response = self._get(lat=QUERY_LAT, lng=QUERY_LNG)
        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)


# --------------------------------------------------------------------------- #
# Tile geometry (pure) — deterministic snapping to ~5 km cells (F-02.8).
# --------------------------------------------------------------------------- #
class TileGeometryTests(APITestCase):
    def test_tile_id_is_southwest_corner(self):
        self.assertEqual(snap_to_tile(QUERY_LAT, QUERY_LNG), "23.75,90.40")

    def test_nearby_points_share_a_tile(self):
        # ~1.4 km apart, same 0.05° cell → same cache key.
        self.assertEqual(snap_to_tile(23.76, 90.41), snap_to_tile(23.77, 90.42))

    def test_distant_points_differ(self):
        self.assertNotEqual(snap_to_tile(23.76, 90.40), snap_to_tile(23.82, 90.46))


# --------------------------------------------------------------------------- #
# Tile cache + coverage tracking (F-02.8) — exercised over stub providers and
# the real DB, so hits/misses, dedupe, TTL, and degradation are all covered.
# --------------------------------------------------------------------------- #
class TileCacheTests(APITestCase):
    QUERY_TILE = "23.75,90.40"

    def _near(self):  # ~111 m north of the query point — inside the radius
        return _mosque("near", "Near Mosque", 0.0, lat=23.7816, lng=90.4070)

    def _far(self):  # ~11 km north — outside the 5 km radius
        return _mosque("far", "Far Mosque", 0.0, lat=23.8806, lng=90.4070)

    def _find(self, providers):
        return find_nearby_mosques(QUERY_LAT, QUERY_LNG, 5000, providers=providers)

    def test_miss_populates_db_and_writes_receipt(self):
        provider = _StubProvider("primary", result=[self._near()])
        results = self._find([provider])

        self.assertTrue(provider.called)
        self.assertEqual([m.external_id for m in results], ["near"])
        self.assertEqual(MosqueRecord.objects.count(), 1)
        self.assertTrue(FetchedTile.objects.filter(pk=self.QUERY_TILE).exists())

    def test_hit_serves_from_db_without_calling_provider(self):
        self._find([_StubProvider("primary", result=[self._near()])])
        # A second request must not touch the network: this provider would raise.
        guard = _StubProvider("primary", error=GeoProviderError("must not be called"))
        results = self._find([guard])

        self.assertFalse(guard.called)
        self.assertEqual([m.external_id for m in results], ["near"])

    def test_radius_filters_far_mosques_but_keeps_them_cached(self):
        results = self._find([_StubProvider("primary", result=[self._near(), self._far()])])

        self.assertEqual([m.external_id for m in results], ["near"])
        # The whole tile fetch is cached even though "far" is outside the radius.
        self.assertEqual(MosqueRecord.objects.count(), 2)

    def test_overlapping_fetches_dedupe_by_external_id(self):
        self._find([_StubProvider("primary", result=[self._near()])])
        invalidate_tile_at(QUERY_LAT, QUERY_LNG)
        renamed = _mosque("near", "Renamed Mosque", 0.0, lat=23.7816, lng=90.4070)
        self._find([_StubProvider("primary", result=[renamed])])

        self.assertEqual(
            MosqueRecord.objects.filter(source="geoapify", external_id="near").count(), 1
        )
        self.assertEqual(MosqueRecord.objects.get(external_id="near").name, "Renamed Mosque")

    def test_empty_area_records_receipt_and_does_not_refetch(self):
        self._find([_StubProvider("primary", result=[])])
        self.assertTrue(FetchedTile.objects.filter(pk=self.QUERY_TILE).exists())

        guard = _StubProvider("primary", error=GeoProviderError("must not refetch"))
        results = self._find([guard])
        self.assertFalse(guard.called)
        self.assertEqual(results, [])

    def test_stale_tile_triggers_refetch(self):
        self._find([_StubProvider("primary", result=[self._near()])])
        self._age_tile(days=31)

        refetch = _StubProvider("primary", result=[self._near()])
        self._find([refetch])
        self.assertTrue(refetch.called)

    def test_cold_tile_provider_failure_raises(self):
        with self.assertRaises(GeoProviderError):
            self._find([_StubProvider("primary", error=GeoProviderError("down"))])

    def test_stale_tile_provider_failure_serves_stale_cache(self):
        self._find([_StubProvider("primary", result=[self._near()])])
        self._age_tile(days=31)

        down = _StubProvider("primary", error=GeoProviderError("down"))
        results = self._find([down])
        self.assertTrue(down.called)  # it attempted a refresh
        self.assertEqual([m.external_id for m in results], ["near"])  # then served stale

    def test_invalidate_drops_receipt_and_forces_refetch(self):
        self._find([_StubProvider("primary", result=[self._near()])])
        invalidate_tile_at(QUERY_LAT, QUERY_LNG)
        self.assertFalse(FetchedTile.objects.filter(pk=self.QUERY_TILE).exists())

        refetch = _StubProvider("primary", result=[self._near()])
        self._find([refetch])
        self.assertTrue(refetch.called)

    def _age_tile(self, *, days):
        tile = FetchedTile.objects.get(pk=self.QUERY_TILE)
        tile.fetched_at = timezone.now() - timedelta(days=days)
        tile.save(update_fields=["fetched_at"])
