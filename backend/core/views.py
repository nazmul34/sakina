"""Core views for the Sakina backend."""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from .geo import (
    DEFAULT_RADIUS_M,
    MAX_RADIUS_M,
    GeoProviderError,
    Mosque,
    find_nearby_mosques,
)


@api_view(["GET"])
@permission_classes([AllowAny])
def health(_request: Request) -> Response:
    """Liveness probe used to verify the API is running.

    Returns a small JSON payload so uptime monitors (and humans) can confirm
    the service is up without touching the database.
    """
    return Response({"status": "ok", "service": "sakina-backend"})


@api_view(["GET"])
@permission_classes([AllowAny])
def mosques(request: Request) -> Response:
    """``GET /mosques?lat=&lng=&radius_m=`` — nearby mosques, nearest first (F-02.1).

    Validates the query point, clamps the radius to FR-2.1 bounds, then resolves
    mosques through the geo layer (Geoapify proxy; cache/fallback slot in behind
    ``find_nearby_mosques`` via #47/#41). Distances are haversine metres and the
    list is sorted by proximity.

    A provider failure returns ``502`` rather than ``500`` so the client can fall
    back to its own cached results (FR-2.3).
    """
    try:
        lat = _parse_coord(request.query_params.get("lat"), "lat", limit=90.0)
        lng = _parse_coord(request.query_params.get("lng"), "lng", limit=180.0)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    radius_m = _clamp_radius(request.query_params.get("radius_m"))
    if radius_m is None:
        return Response(
            {"detail": "radius_m must be a positive number"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        results = find_nearby_mosques(lat, lng, radius_m)
    except GeoProviderError:
        return Response(
            {"detail": "Mosque provider is unavailable; try again shortly."},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    return Response(
        {
            "count": len(results),
            "radius_m": radius_m,
            "mosques": [_serialize(m) for m in results],
        }
    )


def _parse_coord(raw: object, name: str, *, limit: float) -> float:
    """Parse and range-check a required lat/lng query param, in degrees.

    Raises ``ValueError`` with a client-facing message when missing, non-numeric,
    or outside ``[-limit, limit]``.
    """
    if raw is None or raw == "":
        raise ValueError(f"{name} is required")
    try:
        value = float(raw)
    except (TypeError, ValueError):
        raise ValueError(f"{name} must be a number") from None
    if not -limit <= value <= limit:
        raise ValueError(f"{name} must be between -{limit:g} and {limit:g}")
    return value


def _clamp_radius(raw: object) -> "int | None":
    """Resolve the search radius in metres, clamped to FR-2.1 bounds.

    Missing/blank → default 300 m. A valid value is clamped to ``[1, 5000]`` so
    an over-large request can't hammer the provider. Returns ``None`` for a
    non-numeric or non-positive value so the caller can answer ``400``.
    """
    if raw is None or raw == "":
        return DEFAULT_RADIUS_M
    try:
        value = int(float(raw))
    except (TypeError, ValueError):
        return None
    if value <= 0:
        return None
    return min(value, MAX_RADIUS_M)


def _serialize(mosque: Mosque) -> dict:
    """Shape a :class:`Mosque` for the JSON response (name + distance + pin)."""
    return {
        "external_id": mosque.external_id,
        "name": mosque.name,
        "lat": mosque.lat,
        "lng": mosque.lng,
        "distance_m": round(mosque.distance_m, 1),
        "source": mosque.source,
    }
