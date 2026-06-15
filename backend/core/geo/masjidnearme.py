"""MasjidNearMe provider — the primary mosque source (F-02.1, FR-2.5).

A dedicated, community-sourced masjid database with far better coverage than
OSM in under-mapped regions (e.g. Bangladesh, where OSM/Geoapify return a
handful of mosques but this source returns the full local set). Same
:class:`~core.geo.base.MosqueProvider` interface as the others, so it sits at
the head of the chain with Geoapify/Overpass as fallbacks.

Two quirks this module normalises away:
- The API's ``radius`` is *advisory* — it returns a fixed set of nearest
  masjids and overshoots the requested circle, so we filter to ``radius_m`` by
  haversine to honour the interface contract.
- Coordinates are GeoJSON ``[lng, lat]`` under ``masjidLocation.coordinates``,
  not the lat-first order most APIs use.
"""

from typing import Optional

import requests
from django.conf import settings

from .base import GeoProviderError, Mosque, MosqueProvider
from .distance import haversine_m

# Community masjid API. Note the param is `lng` (not `lon`); `radius` is advisory.
DEFAULT_MASJIDNEARME_URL = "https://api.masjidnear.me/v1/masjids/search"

# FR-2.3: 15s network timeout, then graceful failure (fall through to Geoapify).
DEFAULT_TIMEOUT_S = 15


class MasjidNearMeProvider(MosqueProvider):
    """Resolve nearby mosques via the masjidnear.me community API."""

    name = "masjidnearme"

    def find_nearby(self, lat: float, lng: float, radius_m: int) -> list[Mosque]:
        url = getattr(settings, "MASJIDNEARME_API_URL", DEFAULT_MASJIDNEARME_URL)
        timeout = getattr(settings, "MASJIDNEARME_TIMEOUT_S", DEFAULT_TIMEOUT_S)

        params = {"lat": lat, "lng": lng, "radius": radius_m}
        try:
            response = requests.get(url, params=params, timeout=timeout)
            response.raise_for_status()
            payload = response.json()
        except (requests.RequestException, ValueError) as exc:
            raise GeoProviderError(f"MasjidNearMe request failed: {exc}") from exc

        masjids = (payload.get("data") or {}).get("masjids") or []
        parsed = (self._parse_masjid(m, lat, lng) for m in masjids)
        # The API overshoots the requested circle, so enforce radius_m ourselves.
        return [m for m in parsed if m is not None and m.distance_m <= radius_m]

    def _parse_masjid(
        self, masjid: dict, origin_lat: float, origin_lng: float
    ) -> Optional[Mosque]:
        """Map one masjid record to a :class:`Mosque`, or ``None`` if unplaceable.

        ``masjidLocation`` is a GeoJSON Point, so ``coordinates`` is
        ``[lng, lat]``. Drop anything missing coordinates or an id.
        """
        coords = (masjid.get("masjidLocation") or {}).get("coordinates") or []
        if len(coords) != 2:
            return None
        mosque_lng, mosque_lat = coords[0], coords[1]

        external_id = masjid.get("_id")
        if not external_id:
            return None

        return Mosque(
            external_id=str(external_id),
            name=masjid.get("masjidName"),
            lat=float(mosque_lat),
            lng=float(mosque_lng),
            distance_m=haversine_m(
                origin_lat, origin_lng, float(mosque_lat), float(mosque_lng)
            ),
            source=self.name,
        )
