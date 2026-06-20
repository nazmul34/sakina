"""
Models for the core app.

Each concrete model lives in its own module; the reusable abstract bases live
in the ``base`` subpackage. Everything is re-exported here so callers can use
the flat ``from core.models import Device`` import (and so Django discovers the
models on app load).
"""

from .base import (
    SoftDeleteManager,
    SoftDeleteModel,
    SoftDeleteQuerySet,
    TimeStampedModel,
    UUIDModel,
)
from .device import Device
from .fetched_tile import FetchedTile
from .mosque import Mosque
from .pin import Pin

__all__ = [
    "UUIDModel",
    "TimeStampedModel",
    "SoftDeleteModel",
    "SoftDeleteManager",
    "SoftDeleteQuerySet",
    "Device",
    "Mosque",
    "FetchedTile",
    "Pin",
]
