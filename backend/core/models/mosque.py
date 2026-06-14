"""Cached mosque rows backing nearby discovery (F-02.8, #47)."""

from django.db import models

from .base import TimeStampedModel, UUIDModel


class Mosque(UUIDModel, TimeStampedModel):
    """A mosque cached from a geo provider so nearby lookups can be served from
    our own DB instead of hitting Geoapify on every request (#47).

    Deduped by ``(source, external_id)``: overlapping tile fetches upsert the
    same row rather than duplicating it, and a re-fetch refreshes name/coords in
    place (``updated_at`` tracks when). This is a *cache* of provider-owned data
    (Geoapify/OSM), refreshed on the tile TTL — never a source of truth, so
    crowdsourced corrections live elsewhere (EPIC-08), not as edits here.

    The API never exposes this row's ``id``; it serves the opaque ``public_id``
    derived from ``(source, external_id)`` (see :class:`core.geo.base.Mosque`).
    """

    source = models.CharField(max_length=32)
    external_id = models.CharField(max_length=255)
    name = models.CharField(max_length=255, null=True, blank=True)
    lat = models.FloatField()
    lng = models.FloatField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["source", "external_id"],
                name="uniq_mosque_source_external_id",
            ),
        ]
        # Backs the bounding-box prefilter in the cached nearby query.
        indexes = [models.Index(fields=["lat", "lng"], name="mosque_lat_lng_idx")]

    def __str__(self) -> str:
        return f"{self.name or '(unnamed)'} [{self.source}:{self.external_id}]"
