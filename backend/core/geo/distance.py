"""Great-circle distance helpers (Path B — haversine, no PostGIS).

The PRD (§7.3) chose haversine in Python over a geo extension so the backend
runs on any free Postgres (or SQLite). All distances are in **metres**.
"""

from math import asin, cos, radians, sin, sqrt

# Mean Earth radius in metres (IUGG). Good to well within the accuracy we need
# for ranking mosques a few kilometres away.
EARTH_RADIUS_M = 6_371_000.0


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return the great-circle distance between two points, in metres.

    Coordinates are decimal degrees. Accurate to a fraction of a percent at the
    short ranges (≤ 5 km) this endpoint deals with.
    """
    phi1, phi2 = radians(lat1), radians(lat2)
    d_phi = radians(lat2 - lat1)
    d_lambda = radians(lng2 - lng1)

    a = sin(d_phi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_M * asin(sqrt(a))
