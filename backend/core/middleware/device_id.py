"""Request middleware for the anonymous device-ID flow (F-00.4)."""

import uuid

from django.utils.deprecation import MiddlewareMixin

from ..models import Device

# Django exposes the ``X-Device-Id`` request header under this WSGI META key.
DEVICE_ID_HEADER = "HTTP_X_DEVICE_ID"


class DeviceIdMiddleware(MiddlewareMixin):
    """Resolve the client's device from the ``X-Device-Id`` header.

    On first contact from a device we upsert a ``Device`` row; later requests
    reuse it. The resolved device (or ``None``) is attached to
    ``request.device`` so views can sync feature data off it.

    A missing or malformed header is tolerated — the request proceeds
    anonymously rather than failing — so liveness probes and any future
    unauthenticated traffic still work.
    """

    def process_request(self, request):
        request.device = None

        raw = request.META.get(DEVICE_ID_HEADER)
        if not raw:
            return

        try:
            device_id = uuid.UUID(raw)
        except (ValueError, TypeError, AttributeError):
            return

        # Look up via ``all_objects`` so a soft-deleted device that contacts us
        # again is found and resurrected rather than colliding on its PK.
        device, created = Device.all_objects.get_or_create(device_id=device_id)
        if not created and device.is_deleted:
            device.restore()

        request.device = device
