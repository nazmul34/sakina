"""
Reusable abstract base models for the Sakina backend.

Small, composable mixins that give concrete models a consistent identity
(UUID primary key), audit timestamps, and soft-delete semantics. Compose only
the pieces a model needs::

    class Foo(UUIDModel, TimeStampedModel, SoftDeleteModel):
        ...
"""

from .soft_delete import SoftDeleteManager, SoftDeleteModel, SoftDeleteQuerySet
from .timestamped import TimeStampedModel
from .uuid import UUIDModel

__all__ = [
    "UUIDModel",
    "TimeStampedModel",
    "SoftDeleteModel",
    "SoftDeleteManager",
    "SoftDeleteQuerySet",
]
