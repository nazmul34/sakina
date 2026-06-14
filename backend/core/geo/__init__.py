"""Geo layer for nearby-mosque discovery (EPIC-02).

Public surface kept deliberately small so the provider (Geoapify primary,
Overpass fallback) and the distance/cache strategy (#47) can change behind
``find_nearby_mosques`` without touching the ``GET /mosques`` view.
"""

from .base import GeoProviderError, Mosque, MosqueProvider
from .service import find_nearby_mosques

# Note: the search radius is a server-side setting (``MOSQUE_SEARCH_RADIUS_M``,
# FR-2.1), fixed per request by the view — not a geo-layer constant.

__all__ = [
    "find_nearby_mosques",
    "Mosque",
    "MosqueProvider",
    "GeoProviderError",
]
