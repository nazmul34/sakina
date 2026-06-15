"""Tile cache + coverage tracking in front of the provider chain (F-02.8, #47).

The seam the ``GET /mosques`` view calls. It turns "hit Geoapify on every
request" into "fetch an area once, serve everyone else from our DB":

    snap (lat,lng) → tile_id
      fresh FetchedTile for tile_id?
        no  → fetch_from_providers(tile centre + margin) → upsert mosques
              → write/refresh the FetchedTile receipt
        yes → skip the network entirely
    → query the DB for mosques within the user's radius (haversine), nearest first

The receipt (:class:`core.models.FetchedTile`) is what makes empty areas cheap:
"checked here, found nothing" is recorded too, so a barren tile isn't re-queried
until its TTL lapses. On a provider failure we serve a stale tile's rows if we
have them, and only surface ``GeoProviderError`` (→ 502) when the tile has never
been fetched.
"""

import logging
from datetime import timedelta
from math import cos, radians
from typing import Optional, Sequence

from django.conf import settings
from django.utils import timezone

from ..models import FetchedTile
from ..models import Mosque as MosqueRecord
from .base import GeoProviderError, Mosque, MosqueProvider
from .distance import haversine_m
from .service import fetch_from_providers
from .tiles import snap_to_tile, tile_center, tile_fetch_radius_m

logger = logging.getLogger(__name__)

# How long a coverage receipt stays fresh. Mosque locations rarely move, so a
# generous default keeps provider calls rare; tunable via env for ops.
DEFAULT_TILE_TTL_DAYS = 30

# Path B: degrees↔metres conversion for the bounding-box prefilter (haversine
# does the exact check). One degree of latitude is ~111.32 km everywhere.
_METERS_PER_DEG_LAT = 111_320.0


def _tile_ttl() -> timedelta:
    return timedelta(
        days=getattr(settings, "MOSQUE_TILE_TTL_DAYS", DEFAULT_TILE_TTL_DAYS)
    )


def find_nearby_mosques(
    lat: float,
    lng: float,
    radius_m: int,
    providers: Optional[Sequence[MosqueProvider]] = None,
) -> list[Mosque]:
    """Return cached mosques within ``radius_m`` of ``(lat, lng)``, nearest first.

    Refreshes the covering tile from the provider on a miss/stale receipt, then
    answers from the DB. Raises :class:`GeoProviderError` only when the tile has
    never been fetched *and* the refresh fails — a stale tile is served rather
    than failing (FR-2.3).
    """
    tile_id = snap_to_tile(lat, lng)
    receipt = FetchedTile.objects.filter(pk=tile_id).first()
    fresh = receipt is not None and receipt.fetched_at >= timezone.now() - _tile_ttl()

    if not fresh:
        try:
            _populate_tile(tile_id, lat, lng, providers)
        except GeoProviderError:
            if receipt is None:
                raise  # never covered this area, and we can't now → let view 502
            logger.warning(
                "tile %s refresh failed; serving stale cached mosques", tile_id
            )

    return _query_cached(lat, lng, radius_m)


def _populate_tile(
    tile_id: str,
    lat: float,
    lng: float,
    providers: Optional[Sequence[MosqueProvider]],
) -> None:
    """Fetch the tile's area from a provider, upsert mosques, and write the receipt.

    Fetches around the tile *centre* with a boundary margin (not the user's
    point) so one fetch covers the whole cell and its edges. The receipt is
    written even when zero mosques come back, so an empty tile isn't re-queried.
    """
    center_lat, center_lng = tile_center(lat, lng)
    radius_m = tile_fetch_radius_m(center_lat, center_lng)

    mosques = fetch_from_providers(center_lat, center_lng, radius_m, providers)
    _upsert_mosques(mosques)

    FetchedTile.objects.update_or_create(
        tile_id=tile_id,
        defaults={
            "fetched_at": timezone.now(),
            "source": mosques[0].source if mosques else "",
        },
    )


def _upsert_mosques(mosques: Sequence[Mosque]) -> None:
    """Insert or refresh each mosque, deduped by ``(source, external_id)``."""
    for m in mosques:
        MosqueRecord.objects.update_or_create(
            source=m.source,
            external_id=m.external_id,
            defaults={"name": m.name, "lat": m.lat, "lng": m.lng},
        )


def _query_cached(lat: float, lng: float, radius_m: int) -> list[Mosque]:
    """Return cached mosques within ``radius_m`` of ``(lat, lng)``, nearest first.

    A cheap lat/lng bounding box (using the indexed columns) narrows the rows,
    then exact haversine filters and sorts them.
    """
    lat_delta = radius_m / _METERS_PER_DEG_LAT
    lng_delta = radius_m / (_METERS_PER_DEG_LAT * max(cos(radians(lat)), 1e-6))

    rows = MosqueRecord.objects.filter(
        lat__gte=lat - lat_delta,
        lat__lte=lat + lat_delta,
        lng__gte=lng - lng_delta,
        lng__lte=lng + lng_delta,
    )

    results = []
    for row in rows:
        distance_m = haversine_m(lat, lng, row.lat, row.lng)
        if distance_m <= radius_m:
            results.append(
                Mosque(
                    external_id=row.external_id,
                    name=row.name,
                    lat=row.lat,
                    lng=row.lng,
                    distance_m=distance_m,
                    source=row.source,
                )
            )

    results.sort(key=lambda m: m.distance_m)
    return results


def invalidate_tile_at(lat: float, lng: float) -> None:
    """Drop the receipt for the tile covering ``(lat, lng)`` so it re-fetches next.

    The seam EPIC-08 calls when a crowdsourced edit lands, satisfying #47's
    "crowdsourced edit invalidates the relevant tile". Deleting the receipt (not
    the mosques) forces a fresh provider fetch on the next request.
    """
    FetchedTile.objects.filter(pk=snap_to_tile(lat, lng)).delete()
