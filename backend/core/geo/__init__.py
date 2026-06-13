"""Geo layer for nearby-mosque discovery (EPIC-02).

Public surface kept deliberately small so the provider (Geoapify primary,
Overpass fallback — #41) and the distance/cache strategy (#47) can change
behind ``find_nearby_mosques`` without touching the ``GET /mosques`` view.
"""

from .geoapify import GeoProviderError, Mosque, find_nearby_mosques

# Configurable radius bounds (FR-2.1): default 300 m, hard cap 5000 m. The view
# clamps client input into ``[1, MAX_RADIUS_M]`` and defaults to DEFAULT.
DEFAULT_RADIUS_M = 300
MAX_RADIUS_M = 5000

__all__ = [
    "find_nearby_mosques",
    "Mosque",
    "GeoProviderError",
    "DEFAULT_RADIUS_M",
    "MAX_RADIUS_M",
]
