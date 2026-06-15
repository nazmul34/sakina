"""Map-tile geometry for the mosque cache (F-02.8, #47).

Pure functions, no DB: lay an invisible ~1 km grid over the map and map any
``(lat, lng)`` to the discrete cell it falls in, so everyone in the same cell
shares one cache entry. A tile is named by its south-west corner (rounded down
to the grid), which keeps the id deterministic and human-readable
(``"23.75,90.40"``).

Tiles are kept small (~1 km) so each provider fetch covers a tight area; see the
#47 decision (rounded 0.01° over geohash for simplicity and determinism).
"""

import math

from .distance import haversine_m

# Grid step in degrees. 0.01° ≈ 1.1 km of latitude (less in longitude away from
# the equator), so a tile's centre→corner radius peaks at ~0.8 km. Two decimals
# capture the grid exactly, keeping tile ids clean.
TILE_SIZE_DEG = 0.01

# Populate each tile by fetching a circle a bit larger than the tile itself, so a
# mosque just across a tile edge isn't missed — completeness is non-negotiable
# for auto-silent (F-01.2). This is the slack beyond the tile's own half-diagonal.
TILE_FETCH_MARGIN_M = 500


def _floor_to_grid(value: float) -> float:
    """Round ``value`` down to the tile grid (the cell's low edge)."""
    return math.floor(value / TILE_SIZE_DEG) * TILE_SIZE_DEG


def snap_to_tile(lat: float, lng: float) -> str:
    """Map a coordinate to its tile id — the cell's south-west corner.

    Deterministic: any two points in the same cell return the same id, so they
    share a cache entry. Two decimals exactly capture the 0.01° grid.
    """
    return f"{_floor_to_grid(lat):.2f},{_floor_to_grid(lng):.2f}"


def tile_center(lat: float, lng: float) -> tuple[float, float]:
    """Return the ``(lat, lng)`` centre of the tile containing the coordinate.

    The fetch that populates a tile is centred here, not on the user, so one
    fetch covers the whole cell regardless of where in it the user stands.
    """
    half = TILE_SIZE_DEG / 2
    return (_floor_to_grid(lat) + half, _floor_to_grid(lng) + half)


def tile_fetch_radius_m(center_lat: float, center_lng: float) -> int:
    """Radius (m) to fetch around a tile centre to cover the tile + boundary margin.

    The tile's corners are its farthest points from the centre; we take the
    largest centre→corner distance (longitude cells shrink with latitude) and add
    ``TILE_FETCH_MARGIN_M``.
    """
    half = TILE_SIZE_DEG / 2
    corners = (
        (center_lat + half, center_lng + half),
        (center_lat + half, center_lng - half),
        (center_lat - half, center_lng + half),
        (center_lat - half, center_lng - half),
    )
    half_diagonal_m = max(
        haversine_m(center_lat, center_lng, clat, clng) for clat, clng in corners
    )
    return math.ceil(half_diagonal_m) + TILE_FETCH_MARGIN_M
