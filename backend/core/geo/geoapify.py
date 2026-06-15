"""Geoapify Places provider — the primary mosque source (F-02.1, FR-2.5).

OSM-backed, managed reliability, and a free tier that permits caching/storing
results (decision D-3). Implements the :class:`~core.geo.base.MosqueProvider`
interface so it sits interchangeably behind the geo service with the Overpass
fallback. Scope of *this* module: the Geoapify HTTP call + parsing. It hits the
network on every call; caching lives in F-02.8 (#47).
"""

from typing import Optional

import requests
from django.conf import settings

from .base import GeoProviderError, Mosque, MosqueProvider
from .distance import haversine_m

# Geoapify Places API. The category filter is OSM's tag for Islamic places of
# worship; the circle filter and bias both expect **lon,lat** order (a common
# footgun — Geoapify is lon-first, unlike most lat-first APIs).
GEOAPIFY_PLACES_URL = "https://api.geoapify.com/v2/places"
MOSQUE_CATEGORY = "religion.place_of_worship.islam"

# Fetch generously (not the default 20) so auto-silent completeness holds — a
# missed mosque means no silencing there. Cost stays ~1–5 credits/fetch and the
# tile cache (#47) makes fetches rare. See the issue's "Fetch generously" note.
GEOAPIFY_LIMIT = 100

# FR-2.3: 15s network timeout, then graceful failure.
DEFAULT_TIMEOUT_S = 15


class GeoapifyProvider(MosqueProvider):
    """Resolve nearby mosques via Geoapify Places."""

    name = "geoapify"

    def find_nearby(self, lat: float, lng: float, radius_m: int) -> list[Mosque]:
        api_key = getattr(settings, "GEOAPIFY_API_KEY", "")
        if not api_key:
            raise GeoProviderError("GEOAPIFY_API_KEY is not configured")

        params = {
            "categories": MOSQUE_CATEGORY,
            # circle:LON,LAT,RADIUS — lon first.
            "filter": f"circle:{lng},{lat},{radius_m}",
            # Rank Geoapify's own paging toward the query point.
            "bias": f"proximity:{lng},{lat}",
            "limit": GEOAPIFY_LIMIT,
            "apiKey": api_key,
        }

        timeout = getattr(settings, "GEOAPIFY_TIMEOUT_S", DEFAULT_TIMEOUT_S)
        try:
            response = requests.get(GEOAPIFY_PLACES_URL, params=params, timeout=timeout)
            response.raise_for_status()
            payload = response.json()
        except (requests.RequestException, ValueError) as exc:
            # ValueError covers a non-JSON body; RequestException covers
            # timeouts, connection failures, and non-2xx (via raise_for_status).
            raise GeoProviderError(f"Geoapify request failed: {exc}") from exc

        return [
            m for m in (self._parse_feature(f, lat, lng) for f in payload.get("features", []))
            if m is not None
        ]

    def _parse_feature(
        self, feature: dict, origin_lat: float, origin_lng: float
    ) -> Optional[Mosque]:
        """Map one Geoapify GeoJSON feature to a :class:`Mosque`, or ``None``.

        Returns ``None`` for a feature we can't place (no coordinates or no id) —
        better to drop one unmappable row than fail the whole response.
        """
        props = feature.get("properties") or {}

        mosque_lat = props.get("lat")
        mosque_lng = props.get("lon")
        if mosque_lat is None or mosque_lng is None:
            coords = (feature.get("geometry") or {}).get("coordinates") or []
            if len(coords) == 2:  # GeoJSON is [lon, lat].
                mosque_lng, mosque_lat = coords[0], coords[1]
            else:
                return None

        external_id = props.get("place_id")
        if not external_id:
            return None

        return Mosque(
            external_id=str(external_id),
            name=props.get("name"),
            lat=float(mosque_lat),
            lng=float(mosque_lng),
            distance_m=haversine_m(
                origin_lat, origin_lng, float(mosque_lat), float(mosque_lng)
            ),
            source=self.name,
        )
