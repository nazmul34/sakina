"""Soft-delete abstract base model, plus its manager and queryset."""

from django.db import models
from django.utils import timezone


class SoftDeleteQuerySet(models.QuerySet):
    """A QuerySet whose ``delete()`` tombstones rows instead of removing them."""

    def delete(self):
        return super().update(deleted_at=timezone.now())

    def hard_delete(self):
        return super().delete()

    def alive(self):
        return self.filter(deleted_at__isnull=True)

    def dead(self):
        return self.exclude(deleted_at__isnull=True)


class SoftDeleteManager(models.Manager):
    """Default manager that hides soft-deleted rows from ordinary queries."""

    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db).alive()


class SoftDeleteModel(models.Model):
    """Adds a ``deleted_at`` tombstone and soft-delete behaviour.

    ``objects`` returns only live rows; ``all_objects`` includes soft-deleted
    ones. ``delete()`` sets the tombstone, ``restore()`` clears it, and
    ``hard_delete()`` performs a real database delete.
    """

    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)

    objects = SoftDeleteManager()
    all_objects = SoftDeleteQuerySet.as_manager()

    class Meta:
        abstract = True

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    def delete(self, using=None, keep_parents=False):
        self.deleted_at = timezone.now()
        # Scoped to deleted_at so this mixin stays independent of TimeStampedModel.
        self.save(using=using, update_fields=["deleted_at"])

    def restore(self, using=None):
        self.deleted_at = None
        self.save(using=using, update_fields=["deleted_at"])

    def hard_delete(self, using=None, keep_parents=False):
        return super().delete(using=using, keep_parents=keep_parents)
