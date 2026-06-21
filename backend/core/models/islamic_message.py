"""IslamicMessage model — daily reminder content (F-04.1)."""

from django.db import models

from .base import UUIDModel


class IslamicMessage(UUIDModel):
    """A piece of Islamic content returned by the daily-message endpoint (FR-4.1/4.2).

    Category choices map to the four buckets the PRD names; the endpoint
    supports ``?category=`` filtering against this field.  Only rows with
    ``is_active=True`` are served — inactive rows let content be soft-hidden
    without deletion.
    """

    class Category(models.TextChoices):
        QURAN = "quran", "Qur'an"
        HADITH = "hadith", "Hadith"
        DUA = "dua", "Du'a"
        REMINDER = "reminder", "Reminder"

    text = models.TextField()
    source_label = models.CharField(max_length=200, blank=True)
    category = models.CharField(
        max_length=20,
        choices=Category.choices,
        db_index=True,
    )
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        label = self.source_label or self.category
        return f"[{label}] {self.text[:60]}"
