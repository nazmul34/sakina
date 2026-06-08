"""Audit-timestamp abstract base model."""

from django.db import models


class TimeStampedModel(models.Model):
    """Adds self-maintaining ``created_at`` / ``updated_at`` audit columns."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
