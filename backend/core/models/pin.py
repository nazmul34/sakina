"""User-pinned silent zones, synced per device (F-03.2)."""

from django.db import models

from .base import SoftDeleteModel, UUIDModel


class Pin(UUIDModel, SoftDeleteModel):
    """A user-defined silent zone — a labelled location with its own radius that
    behaves like a mosque for auto-silent (FR-3.1/FR-3.3), owned by a device and
    synced offline-first (FR-3.2).

    **Sync model — last-write-wins by ``updated_at``.** Unlike the rest of the
    app, ``updated_at`` here is *client-authoritative*: it's the logical mutation
    time the client supplies, not a server-clock ``auto_now`` stamp. That's what
    makes offline reconciliation deterministic — the client edits a pin while
    offline, and whichever side has the newer ``updated_at`` wins when they next
    meet (consistent with the EPIC-07 settings-sync rule). For the same reason the
    ``id`` is the client-generated UUID (sent on create), so a pin created offline
    keeps one identity across the client and server.

    Deletes are soft (``deleted_at`` via :class:`SoftDeleteModel`) so a removal on
    one device propagates instead of silently reappearing from another; ``GET
    /pins`` returns tombstones too, and the client drops a local pin only once the
    server confirms it's gone.
    """

    device = models.ForeignKey(
        "core.Device",
        on_delete=models.CASCADE,
        related_name="pins",
    )
    label = models.CharField(max_length=120, blank=True)
    lat = models.FloatField()
    lng = models.FloatField()
    radius_m = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    # Client-authoritative mutation time driving last-write-wins (see class doc);
    # deliberately not auto_now, so the view can store the client's value verbatim.
    updated_at = models.DateTimeField()

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["device", "updated_at"])]

    def __str__(self) -> str:
        return f"{self.label or '(unlabelled)'} [{self.lat:.5f},{self.lng:.5f}]"
