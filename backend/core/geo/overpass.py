"""Public Overpass provider — the fallback mosque source (F-02.2, #41).

Used when Geoapify fails or is over quota. Overpass queries OpenStreetMap
directly with no API key, so it also keeps the endpoint working in dev before a
Geoapify key is configured. Same :class:`~core.geo.base.MosqueProvider`
interface as Geoapify, so the service treats them interchangeably.

Note the coordinate-order difference from Geoapify: Overpass ``around:`` is
``radius,LAT,LON`` (lat first), the opposite of Geoapify's lon-first ``circle:``.
"""

from typing import Optional

import requests
from django.conf import settings

from .base import GeoProviderError, Mosque, MosqueProvider
from .distance import haversine_m

DEFAULT_OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Overpass can be slow under load; give it a longer budget than Geoapify. The
# server-side ``[timeout:...]`` is matched to the request timeout below.
DEFAULT_TIMEOUT_S = 25


class OverpassProvider(MosqueProvider):
    """Resolve nearby mosques via the public Overpass API (OSM)."""

    name = "overpass"

    def find_nearby(self, lat: float, lng: float, radius_m: int) -> list[Mosque]:
        url = getattr(settings, "OVERPASS_API_URL", DEFAULT_OVERPASS_URL)
        timeout = getattr(settings, "OVERPASS_TIMEOUT_S", DEFAULT_TIMEOUT_S)

        # nwr = node/way/relation. Most mosques are amenity=place_of_worship +
        # religion=muslim, but many in under-mapped regions carry only
        # building=mosque (no religion tag), so union both to widen coverage —
        # Overpass dedupes overlapping elements. `out center` gives ways/relations
        # a single point.
        query = (
            f"[out:json][timeout:{timeout}];"
            f"("
            f'nwr["amenity"="place_of_worship"]["religion"="muslim"]'
            f"(around:{radius_m},{lat},{lng});"
            f'nwr["building"="mosque"](around:{radius_m},{lat},{lng});'
            f");"
            f"out center tags;"
        )

        try:
            response = requests.post(url, data=query, timeout=timeout)
            response.raise_for_status()
            payload = response.json()
        except (requests.RequestException, ValueError) as exc:
            raise GeoProviderError(f"Overpass request failed: {exc}") from exc

        return [
            m for m in (self._parse_element(e, lat, lng) for e in payload.get("elements", []))
            if m is not None
        ]

    def _parse_element(
        self, element: dict, origin_lat: float, origin_lng: float
    ) -> Optional[Mosque]:
        """Map one Overpass element to a :class:`Mosque`, or ``None``.

        Nodes carry ``lat``/``lon`` directly; ways/relations carry a computed
        ``center``. Drop anything we can't place or identify.
        """
        mosque_lat = element.get("lat")
        mosque_lng = element.get("lon")
        if mosque_lat is None or mosque_lng is None:
            center = element.get("center") or {}
            mosque_lat = center.get("lat")
            mosque_lng = center.get("lon")
        if mosque_lat is None or mosque_lng is None:
            return None

        element_type = element.get("type")
        element_id = element.get("id")
        if not element_type or element_id is None:
            return None

        return Mosque(
            # OSM ids are only unique per element type, so namespace by type.
            external_id=f"{element_type}/{element_id}",
            name=(element.get("tags") or {}).get("name"),
            lat=float(mosque_lat),
            lng=float(mosque_lng),
            distance_m=haversine_m(
                origin_lat, origin_lng, float(mosque_lat), float(mosque_lng)
            ),
            source=self.name,
        )
