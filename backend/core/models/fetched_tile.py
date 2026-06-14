"""Tile coverage receipts for the mosque cache (F-02.8, #47)."""

from django.db import models

from .base import TimeStampedModel


class FetchedTile(TimeStampedModel):
    """A receipt that we queried the provider for one map tile, and when.

    This is the crux of the cache (#47): kept *separate* from the mosque data so
    we can tell "checked here, found 0 mosques" apart from "never checked here".
    Without it, empty or rural tiles would be re-queried against the provider
    forever. A tile is *fresh* while ``fetched_at`` is within the TTL; past that
    the next request re-fetches and refreshes this receipt.

    The id is the deterministic tile key from :func:`core.geo.tiles.snap_to_tile`,
    so everyone inside the same ~5 km cell shares one receipt.
    """

    tile_id = models.CharField(max_length=32, primary_key=True)
    fetched_at = models.DateTimeField()
    # Which provider populated the tile (empty for a tile that yielded no mosques).
    source = models.CharField(max_length=32, blank=True, default="")

    def __str__(self) -> str:
        return f"{self.tile_id} @ {self.fetched_at:%Y-%m-%d %H:%M}"
