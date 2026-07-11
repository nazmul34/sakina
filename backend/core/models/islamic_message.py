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
    # Bangla translations (F-i18n). Optional per row: when blank, the endpoint
    # falls back to the English `text` / `source_label`, so the Bangla UI still
    # shows content for messages not yet translated (e.g. scripture awaiting a
    # vetted translation). Populated from the fixture.
    text_bn = models.TextField(blank=True)
    source_label_bn = models.CharField(max_length=200, blank=True)
    category = models.CharField(
        max_length=20,
        choices=Category.choices,
        db_index=True,
    )
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["id"]

    def text_for(self, lang: str) -> str:
        """The message text in `lang`, falling back to English when untranslated."""
        if lang == "bn" and self.text_bn:
            return self.text_bn
        return self.text

    def source_label_for(self, lang: str) -> str:
        """The source label in `lang`, falling back to English when untranslated."""
        if lang == "bn" and self.source_label_bn:
            return self.source_label_bn
        return self.source_label

    def __str__(self) -> str:
        label = self.source_label or self.category
        return f"[{label}] {self.text[:60]}"
