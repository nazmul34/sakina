"""The anonymous device identity model (F-00.4)."""

from django.conf import settings
from django.db import models

from .base import SoftDeleteModel, TimeStampedModel


class Device(TimeStampedModel, SoftDeleteModel):
    """An anonymous device identity — the backbone every feature syncs off of.

    The primary key is the UUID the client generates on first launch and sends
    on every request via the ``X-Device-Id`` header (F-00.4). A device starts
    anonymous; ``linked_user`` is populated later if/when the user signs in,
    which is how settings carry across reinstalls and across devices.

    It uses its own ``device_id`` primary key instead of ``UUIDModel`` because
    the value is supplied by the client, not generated server-side.
    """

    device_id = models.UUIDField(primary_key=True, editable=False)
    linked_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="devices",
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return str(self.device_id)
