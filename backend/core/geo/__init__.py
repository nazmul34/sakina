"""Geo layer for nearby-mosque discovery (EPIC-02).

Public surface kept deliberately small so the provider (MasjidNearMe primary,
Geoapify then Overpass fallback) and the distance/cache strategy (#47) can change
behind ``find_nearby_mosques`` without touching the ``GET /mosques`` view.
"""

from .base import GeoProviderError, Mosque, MosqueProvider
from .cache import find_nearby_mosques, invalidate_tile_at
from .service import fetch_from_providers

# Note: the search radius is a server-side setting (``MOSQUE_SEARCH_RADIUS_M``,
# FR-2.1), fixed per request by the view — not a geo-layer constant. The tile
# cache TTL is ``MOSQUE_TILE_TTL_DAYS`` (F-02.8).

__all__ = [
    "find_nearby_mosques",
    "fetch_from_providers",
    "invalidate_tile_at",
    "Mosque",
    "MosqueProvider",
    "GeoProviderError",
]
