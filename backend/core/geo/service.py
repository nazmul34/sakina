"""Provider orchestration — the network side of nearby-mosque discovery.

Tries each provider in priority order — Geoapify primary, then the Overpass
fallback — moving on when one raises :class:`GeoProviderError` (failure or
quota), and sorts the first successful result by distance. Because ordering and
provider selection live here, swapping a provider or moving to PostGIS never
touches the caller.

This is the *uncached* path: the #47 tile cache (:mod:`core.geo.cache`) calls
``fetch_from_providers`` only on a tile miss, then serves everyone else from the
DB. The ``GET /mosques`` view goes through the cache's ``find_nearby_mosques``,
not this module directly.
"""

import logging
from typing import Optional, Sequence

from .base import GeoProviderError, Mosque, MosqueProvider
from .geoapify import GeoapifyProvider
from .overpass import OverpassProvider

logger = logging.getLogger(__name__)

# Priority order: primary first, fallbacks after. Tried left-to-right until one
# succeeds. A successful *empty* result is a valid answer (no mosques here) and
# does not trigger fallback — only a raised error does.
DEFAULT_PROVIDERS: tuple[MosqueProvider, ...] = (
    GeoapifyProvider(),
    OverpassProvider(),
)


def fetch_from_providers(
    lat: float,
    lng: float,
    radius_m: int,
    providers: Optional[Sequence[MosqueProvider]] = None,
) -> list[Mosque]:
    """Return mosques within ``radius_m`` of ``(lat, lng)`` from a live provider.

    Walks the provider chain until one returns, then sorts by distance. Raises
    :class:`GeoProviderError` only if *every* provider fails, so the cache (and,
    on a cold tile, the view) can answer ``502`` and let the client fall back to
    its own cache (FR-2.3).
    """
    chain = providers if providers is not None else DEFAULT_PROVIDERS

    last_error: Optional[GeoProviderError] = None
    for provider in chain:
        try:
            mosques = provider.find_nearby(lat, lng, radius_m)
        except GeoProviderError as exc:
            last_error = exc
            logger.warning("Mosque provider %r failed: %s", provider.name, exc)
            continue
        mosques.sort(key=lambda m: m.distance_m)
        return mosques

    raise GeoProviderError("All mosque providers failed") from last_error
