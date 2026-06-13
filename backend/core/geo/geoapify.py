"""Geoapify Places provider for nearby-mosque discovery (F-02.1, FR-2.5).

This is the *primary* mosque source (decision D-3): OSM-backed, managed
reliability, and a free tier that permits caching/storing results. It sits
behind the geo abstraction (F-02.2, #41) so the provider — or the Path B
haversine vs Path A PostGIS distance strategy — can change without touching
callers. A public-Overpass fallback (#41) and the server-side tile cache
(#47) layer on top of this same ``find_nearby_mosques`` seam later.

Scope of *this* module: the Geoapify HTTP call + parsing + distance ranking.
It hits the network on every call; caching lives in F-02.8 (#47).
"""

from dataclasses import dataclass
from typing import Optional

import requests
from django.conf import settings

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


class GeoProviderError(Exception):
    """A nearby-mosque lookup failed (provider down, timeout, or misconfigured).

    Callers translate this into a degraded HTTP response rather than a 500, so
    the client can fall back to its own cached results (FR-2.3).
    """


@dataclass(frozen=True)
class Mosque:
    """A single nearby mosque, normalised across providers.

    ``distance_m`` is the haversine distance from the query point, so callers
    can sort/threshold without re-deriving it. ``source`` records the provider
    so dedupe (#47) and "report incorrect" (FR-2.6) can attribute the row.
    """

    external_id: str
    name: Optional[str]
    lat: float
    lng: float
    distance_m: float
    source: str = "geoapify"


def find_nearby_mosques(lat: float, lng: float, radius_m: int) -> list[Mosque]:
    """Return mosques within ``radius_m`` of ``(lat, lng)``, nearest first.

    Calls Geoapify Places, parses the GeoJSON feature collection, computes the
    haversine distance to each result, and sorts by proximity. Raises
    :class:`GeoProviderError` on timeout, transport error, a non-2xx response,
    or a missing API key.
    """
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
        # ValueError covers a non-JSON body; RequestException covers timeouts,
        # connection failures, and non-2xx (via raise_for_status).
        raise GeoProviderError(f"Geoapify request failed: {exc}") from exc

    mosques = [
        m for m in (_parse_feature(f, lat, lng) for f in payload.get("features", []))
        if m is not None
    ]
    mosques.sort(key=lambda m: m.distance_m)
    return mosques


def _parse_feature(feature: dict, origin_lat: float, origin_lng: float) -> Optional[Mosque]:
    """Map one Geoapify GeoJSON feature to a :class:`Mosque`, or ``None``.

    Returns ``None`` for a feature we can't place (no coordinates) — better to
    drop one unmappable row than fail the whole response.
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
        distance_m=haversine_m(origin_lat, origin_lng, float(mosque_lat), float(mosque_lng)),
    )
