"""Provider-agnostic contract for the geo layer (F-02.2).

Everything callers and providers share lives here: the normalised
:class:`Mosque` result, the :class:`GeoProviderError` failure signal, and the
:class:`MosqueProvider` interface. Concrete providers (Geoapify primary,
Overpass fallback) implement ``find_nearby``; the service in
:mod:`core.geo.service` orchestrates them. Keeping this seam small is what lets
the provider — or the Path B haversine vs Path A PostGIS distance strategy —
change without touching the ``GET /mosques`` view.
"""

import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

# Fixed namespace for deriving a stable, opaque public id from a provider's
# (source, external_id). Lets the API expose one id without leaking which
# provider a mosque came from, and stays stable once #47 persists rows.
_MOSQUE_ID_NAMESPACE = uuid.UUID("6f3a7e0c-1f2b-5d4a-9c8e-0a1b2c3d4e5f")


class GeoProviderError(Exception):
    """A nearby-mosque lookup failed (provider down, timeout, or misconfigured).

    Providers raise this on any failure so the service can fall through to the
    next provider; if every provider raises, the view turns it into a degraded
    HTTP response rather than a 500, so the client can fall back to its own
    cached results (FR-2.3).
    """


@dataclass(frozen=True)
class Mosque:
    """A single nearby mosque, normalised across providers.

    ``distance_m`` is the haversine distance from the query point, so callers
    can sort/threshold without re-deriving it. ``source`` records the provider
    so dedupe (#47) and "report incorrect" (FR-2.6) can attribute the row; it is
    never exposed to the client (see :attr:`public_id`).
    """

    external_id: str
    name: Optional[str]
    lat: float
    lng: float
    distance_m: float
    source: str

    @property
    def public_id(self) -> str:
        """A stable, opaque id for the API to expose.

        Derived from ``(source, external_id)`` so the client never sees the
        provider or its place id, yet the same mosque keeps the same id across
        requests (and once #47 persists rows, across the DB id too).
        """
        return str(uuid.uuid5(_MOSQUE_ID_NAMESPACE, f"{self.source}:{self.external_id}"))


class MosqueProvider(ABC):
    """A source of nearby mosques behind a single ``find_nearby`` interface.

    Implementations own their own transport, query shape, and parsing, but all
    return the same normalised :class:`Mosque` list and raise
    :class:`GeoProviderError` on failure. Ordering is left to the service, so
    swapping a provider — or the distance strategy — changes nothing upstream.
    """

    #: Stable provider tag stored on each :class:`Mosque` as ``source``.
    name: str

    @abstractmethod
    def find_nearby(self, lat: float, lng: float, radius_m: int) -> list[Mosque]:
        """Return mosques within ``radius_m`` of ``(lat, lng)``.

        Distances are haversine metres. Order is not guaranteed (the service
        sorts). Raises :class:`GeoProviderError` on any failure.
        """
        raise NotImplementedError
