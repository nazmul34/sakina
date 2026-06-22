"""Core views for the Sakina backend."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import IntegrityError
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from .geo import GeoProviderError, Mosque, find_nearby_mosques
from .models import DeviceSettings, IslamicMessage, Pin


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
    """``GET /mosques?lat=&lng=`` — nearby mosques, nearest first (F-02.1).

    Validates the query point, then resolves mosques through the geo layer
    (Geoapify primary, Overpass fallback; the #47 tile cache slots in behind the
    same ``find_nearby_mosques`` seam). Distances are haversine metres and the
    list is sorted by proximity.

    The search radius is **fixed server-side** (``MOSQUE_SEARCH_RADIUS_M``,
    FR-2.1): the client neither supplies nor controls it, so any ``radius_m``
    query param is ignored. Returns ``502`` only when *every* provider fails, so
    the client can fall back to its own cached results (FR-2.3).
    """
    try:
        lat = _parse_coord(request.query_params.get("lat"), "lat", limit=90.0)
        lng = _parse_coord(request.query_params.get("lng"), "lng", limit=180.0)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    radius_m = settings.MOSQUE_SEARCH_RADIUS_M

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


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def pins(request: Request) -> Response:
    """``GET`` / ``POST /pins`` — list or create this device's pinned zones (FR-3.2).

    Pins are owned by the device resolved from the ``X-Device-Id`` header, so no
    ``device_id`` is taken from the body/query (it can't be spoofed and matches
    the rest of the app). ``GET`` returns every pin for the device **including
    soft-deleted tombstones**, so a delete on one install propagates to others on
    the next sync. ``POST`` is an idempotent upsert keyed on the client-supplied
    ``id`` (a pin created offline keeps its identity): a new id creates (``201``),
    a known id reconciles by last-write-wins like ``PUT`` (``200``).
    """
    if request.device is None:
        return _device_required()

    if request.method == "GET":
        rows = Pin.all_objects.filter(device=request.device)
        return Response({"pins": [_serialize_pin(p) for p in rows]})

    try:
        fields = _parse_pin_body(request.data)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    pin_id = _parse_pin_id(request.data.get("id"))
    if pin_id is not None:
        existing = Pin.all_objects.filter(device=request.device, id=pin_id).first()
        if existing is not None:
            _apply_last_write_wins(existing, fields)
            return Response(_serialize_pin(existing))

    try:
        pin = Pin.objects.create(
            device=request.device,
            id=pin_id or uuid.uuid4(),
            updated_at=fields["updated_at"] or timezone.now(),
            label=fields["label"],
            lat=fields["lat"],
            lng=fields["lng"],
            radius_m=fields["radius_m"],
        )
    except IntegrityError:
        # The id is a client-generated UUID; a collision with another device's
        # pin is astronomically unlikely but must not 500.
        return Response(
            {"detail": "A pin with this id already exists."},
            status=status.HTTP_409_CONFLICT,
        )
    return Response(_serialize_pin(pin), status=status.HTTP_201_CREATED)


@api_view(["PUT", "DELETE"])
@permission_classes([AllowAny])
def pin_detail(request: Request, pin_id: uuid.UUID) -> Response:
    """``PUT`` / ``DELETE /pins/{id}`` — update or soft-delete one pin (FR-3.2).

    ``PUT`` reconciles by **last-write-wins**: the edit lands only if its
    ``updated_at`` is newer than the stored one (a stale offline edit can't clobber
    a fresher server state), and a winning edit resurrects a tombstoned pin. The
    response always carries the winning state so the client can converge. ``DELETE``
    tombstones the pin (idempotent — a missing/already-deleted pin still returns
    ``204``) so the removal syncs rather than the pin reappearing from elsewhere.
    """
    if request.device is None:
        return _device_required()

    pin = Pin.all_objects.filter(device=request.device, id=pin_id).first()

    if request.method == "DELETE":
        if pin is not None and not pin.is_deleted:
            pin.updated_at = timezone.now()
            pin.deleted_at = pin.updated_at
            pin.save(update_fields=["updated_at", "deleted_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    if pin is None:
        return Response(
            {"detail": "Pin not found."}, status=status.HTTP_404_NOT_FOUND
        )
    try:
        fields = _parse_pin_body(request.data)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    _apply_last_write_wins(pin, fields)
    return Response(_serialize_pin(pin))


@api_view(["GET", "PUT"])
@permission_classes([AllowAny])
def device_settings(request: Request, device_id: uuid.UUID) -> Response:
    """``GET`` / ``PUT /devices/{id}/settings`` — read or upsert device settings (FR-8.1).

    Settings are keyed by device ID. The ``{id}`` in the path must match the
    device resolved from the ``X-Device-Id`` header, so a device can only touch
    its own settings (a mismatch is ``403``, consistent with the can't-spoof rule
    the rest of the app follows). ``GET`` returns the stored bundle, materialising
    server defaults on first read so the response is never empty. ``PUT`` upserts:
    any provided field is validated and stored, unspecified fields keep their
    current value, and ``updated_at`` is stamped from the client's value or
    ``now()``. The last-write-wins reconciliation across offline edits is F-07.2;
    here a ``PUT`` simply lands.
    """
    if request.device is None:
        return _device_required()
    if request.device.device_id != device_id:
        return Response(
            {"detail": "Device id does not match the X-Device-Id header."},
            status=status.HTTP_403_FORBIDDEN,
        )

    row, _ = DeviceSettings.objects.get_or_create(device=request.device)

    if request.method == "GET":
        return Response(_serialize_settings(row))

    try:
        fields = _parse_settings_body(request.data)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    for name, value in fields.items():
        setattr(row, name, value)
    row.updated_at = fields.get("updated_at") or timezone.now()
    row.save()
    return Response(_serialize_settings(row))


@api_view(["GET"])
@permission_classes([AllowAny])
def random_message(request: Request) -> Response:
    """``GET /messages/random`` — one random active Islamic message (FR-4.1/4.2).

    Optionally filter by ``?category=`` (quran / hadith / dua / reminder).
    Returns ``404`` when no active messages match (e.g. unknown category or
    empty seed), ``400`` when the category value is not a recognised choice.
    """
    qs = IslamicMessage.objects.filter(is_active=True)

    category = request.query_params.get("category")
    if category is not None:
        valid = {c.value for c in IslamicMessage.Category}
        if category not in valid:
            return Response(
                {"detail": f"Invalid category. Valid values: {', '.join(sorted(valid))}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        qs = qs.filter(category=category)

    msg = qs.order_by("?").first()
    if msg is None:
        return Response(
            {"detail": "No messages available."},
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response(_serialize_message(msg))


def _serialize_message(msg: IslamicMessage) -> dict:
    return {
        "id": str(msg.id),
        "text": msg.text,
        "source_label": msg.source_label,
        "category": msg.category,
    }


def _device_required() -> Response:
    """Uniform error when a pins request arrives without a resolved device."""
    return Response(
        {"detail": "A valid X-Device-Id header is required."},
        status=status.HTTP_400_BAD_REQUEST,
    )


def _apply_last_write_wins(pin: Pin, fields: dict) -> None:
    """Update ``pin`` from ``fields`` iff the incoming ``updated_at`` is newer.

    The core of FR-3.2's conflict rule: a write only takes effect when it is
    strictly newer than what we hold, so retries and stale offline edits are
    no-ops. A winning write also clears any tombstone — an edit means the pin is
    live again. When the incoming timestamp is missing we stamp ``now()``, which
    is always newer, so an explicit edit without a clock still lands.
    """
    incoming = fields["updated_at"] or timezone.now()
    if incoming <= pin.updated_at:
        return
    pin.label = fields["label"]
    pin.lat = fields["lat"]
    pin.lng = fields["lng"]
    pin.radius_m = fields["radius_m"]
    pin.updated_at = incoming
    pin.deleted_at = None
    pin.save(
        update_fields=["label", "lat", "lng", "radius_m", "updated_at", "deleted_at"]
    )


def _parse_pin_id(raw: object) -> uuid.UUID | None:
    """Parse an optional client-supplied pin id; ``None`` if absent, raise if junk."""
    if raw is None or raw == "":
        return None
    try:
        return uuid.UUID(str(raw))
    except (ValueError, TypeError, AttributeError):
        raise ValueError("id must be a UUID") from None


def _parse_pin_body(data: dict) -> dict:
    """Validate a pin create/update body into normalised fields.

    Raises ``ValueError`` with a client-facing message on any bad field. ``label``
    defaults to empty (a pin may be saved before it's named); ``updated_at`` is
    optional and, when given, must be an ISO-8601 datetime (the caller defaults a
    missing value to ``now()``).
    """
    label = data.get("label", "")
    if not isinstance(label, str):
        raise ValueError("label must be a string")
    if len(label) > 120:
        raise ValueError("label must be at most 120 characters")

    lat = _parse_coord(data.get("lat"), "lat", limit=90.0)
    lng = _parse_coord(data.get("lng"), "lng", limit=180.0)

    raw_radius = data.get("radius_m")
    try:
        radius_m = int(raw_radius)
    except (TypeError, ValueError):
        raise ValueError("radius_m must be an integer") from None
    if radius_m <= 0:
        raise ValueError("radius_m must be a positive number of metres")

    return {
        "label": label,
        "lat": lat,
        "lng": lng,
        "radius_m": radius_m,
        "updated_at": _parse_updated_at(data.get("updated_at")),
    }


def _parse_updated_at(raw: object):
    """Parse an optional ISO-8601 ``updated_at`` into an aware datetime, or ``None``."""
    if raw is None or raw == "":
        return None
    parsed = parse_datetime(str(raw))
    if parsed is None:
        raise ValueError("updated_at must be an ISO-8601 datetime")
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_default_timezone())
    return parsed


def _serialize_pin(pin: Pin) -> dict:
    """Shape a :class:`Pin` for the JSON response, including its sync metadata."""
    return {
        "id": str(pin.id),
        "label": pin.label,
        "lat": pin.lat,
        "lng": pin.lng,
        "radius_m": pin.radius_m,
        "updated_at": pin.updated_at,
        "is_deleted": pin.is_deleted,
    }


def _parse_settings_body(data: dict) -> dict:
    """Validate a settings ``PUT`` body into a dict of fields to store.

    Every field is optional — only keys present in the body are validated and
    returned, so a partial ``PUT`` patches just those and leaves the rest. Choice
    fields are checked against the model's enums and the two interval/radius
    fields must be positive integers. ``updated_at``, when given, must be an
    ISO-8601 datetime (the caller defaults a missing one to ``now()``). Raises
    ``ValueError`` with a client-facing message on any bad field.
    """
    fields: dict = {}

    if "auto_silent_enabled" in data:
        value = data["auto_silent_enabled"]
        if not isinstance(value, bool):
            raise ValueError("auto_silent_enabled must be a boolean")
        fields["auto_silent_enabled"] = value

    if "radius_m" in data:
        fields["radius_m"] = _parse_positive_int(data["radius_m"], "radius_m")

    _parse_choice(data, "theme", DeviceSettings.Theme, fields)
    _parse_choice(data, "prayer_method", DeviceSettings.PrayerMethod, fields)
    _parse_choice(data, "asr_method", DeviceSettings.AsrMethod, fields)

    if "updated_at" in data:
        parsed = _parse_updated_at(data["updated_at"])
        if parsed is not None:
            fields["updated_at"] = parsed

    return fields


def _parse_positive_int(raw: object, name: str) -> int:
    """Parse a strictly-positive integer field, raising ``ValueError`` if not."""
    try:
        value = int(raw)
    except (TypeError, ValueError):
        raise ValueError(f"{name} must be an integer") from None
    if value <= 0:
        raise ValueError(f"{name} must be a positive integer")
    return value


def _parse_choice(data: dict, name: str, choices, fields: dict) -> None:
    """Validate an optional choice field against ``choices`` and add it to ``fields``."""
    if name not in data:
        return
    value = data[name]
    valid = {c.value for c in choices}
    if value not in valid:
        raise ValueError(f"{name} must be one of: {', '.join(sorted(valid))}")
    fields[name] = value


def _serialize_settings(row: DeviceSettings) -> dict:
    """Shape a :class:`DeviceSettings` row for the JSON response."""
    return {
        "device_id": str(row.device_id),
        "auto_silent_enabled": row.auto_silent_enabled,
        "radius_m": row.radius_m,
        "theme": row.theme,
        "prayer_method": row.prayer_method,
        "asr_method": row.asr_method,
        "updated_at": row.updated_at,
    }


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


def _serialize(mosque: Mosque) -> dict:
    """Shape a :class:`Mosque` for the JSON response (id + name + distance + pin).

    Exposes only an opaque ``id``; the provider (``source``) and its raw
    ``external_id`` are internal and never returned to the client.
    """
    return {
        "id": mosque.public_id,
        "name": mosque.name,
        "lat": mosque.lat,
        "lng": mosque.lng,
        "distance_m": round(mosque.distance_m, 1),
    }
