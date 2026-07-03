"""Crowdsourced "report incorrect mosque" submissions (FR-2.6, EPIC-08)."""

from django.db import models

from .base import TimeStampedModel, UUIDModel


class MosqueReport(UUIDModel, TimeStampedModel):
    """A user's flag that a nearby mosque looks wrong — closed, misnamed, or not
    actually a mosque (FR-2.6).

    This is deliberately a **separate, moderated** table, never an edit to
    :class:`core.models.Mosque`: that row is a cache of provider-owned data
    (Geoapify/OSM) refreshed on a TTL, so a report must not mutate it. Reports
    land here as ``PENDING`` and a moderator reconciles them later (EPIC-08 /
    the #47 tile-invalidation hook) before anything touches live data.

    The report stores a **snapshot** of the mosque (``mosque_public_id`` plus the
    name/coords the client was shown) so it stays meaningful even after the
    provider cache refreshes or drops the row. ``mosque_public_id`` is the opaque
    id the API exposes (``core.geo.base.Mosque.public_id``); the client never
    sees the provider or its raw place id, so that is the only mosque identity it
    can send back.

    ``device`` is nullable with ``SET_NULL`` so a report survives its reporter's
    device being deleted — moderation cares about the mosque, not who flagged it.
    """

    class Reason(models.TextChoices):
        CLOSED = "closed", "Closed / no longer exists"
        MISNAMED = "misnamed", "Wrong name or details"
        NOT_A_MOSQUE = "not_a_mosque", "Not actually a mosque"
        UNSPECIFIED = "unspecified", "Unspecified"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending review"
        ACCEPTED = "accepted", "Accepted"
        REJECTED = "rejected", "Rejected"

    device = models.ForeignKey(
        "core.Device",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="mosque_reports",
    )
    # Opaque uuid5 the API exposes for a mosque; not a FK because the cached
    # Mosque row may not exist locally (results can come straight from a
    # provider) and must not be depended on here.
    mosque_public_id = models.CharField(max_length=64)
    # Snapshot of what the reporter was shown, so the report reads correctly even
    # after the provider cache changes. Name is free text and may be long.
    mosque_name = models.TextField(null=True, blank=True)
    lat = models.FloatField()
    lng = models.FloatField()
    reason = models.CharField(
        max_length=16,
        choices=Reason.choices,
        default=Reason.UNSPECIFIED,
    )
    # Optional free-text detail from the reporter.
    note = models.TextField(blank=True)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            # Moderation queue: newest pending reports for one mosque first.
            models.Index(fields=["mosque_public_id", "status"]),
            models.Index(fields=["status", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.mosque_name or '(unnamed)'} [{self.reason}/{self.status}]"
