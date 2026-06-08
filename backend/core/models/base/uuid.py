"""UUID primary-key abstract base model."""

# Absolute import resolves to the stdlib ``uuid`` module, not this file.
from uuid import uuid4

from django.db import models


class UUIDModel(models.Model):
    """Gives a model a non-guessable UUID primary key instead of a serial int."""

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)

    class Meta:
        abstract = True
