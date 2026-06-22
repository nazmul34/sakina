"""Per-device settings synced to the backend (F-07.1)."""

from django.db import models
from django.utils import timezone


class DeviceSettings(models.Model):
    """The settings bundle for one device, keyed by device ID (FR-8.1).

    A single row per :class:`~core.models.Device` (the device *is* the primary
    key, so the relationship is 1:1 and ``GET/PUT /devices/{id}/settings`` map
    straight onto it). It holds the knobs the PRD lists — auto-silent on/off,
    the geofence radius, the location poll interval, the chosen theme, and the
    prayer-time calculation/Asr methods — so a reinstall or a second device can
    recover the user's configuration from the server.

    ``updated_at`` is **client-authoritative** (the logical mutation time the
    client supplies, not a server ``auto_now`` stamp), matching the
    :class:`~core.models.Pin` sync model. F-07.1 just persists it; the
    last-write-wins reconciliation that compares it across offline edits is
    layered on in F-07.2.
    """

    class Theme(models.TextChoices):
        LIGHT = "light", "Light"
        DARK = "dark", "Dark"
        SYSTEM = "system", "System"

    class PrayerMethod(models.TextChoices):
        MUSLIM_WORLD_LEAGUE = "MuslimWorldLeague", "Muslim World League"
        EGYPTIAN = "Egyptian", "Egyptian"
        KARACHI = "Karachi", "Karachi"
        UMM_AL_QURA = "UmmAlQura", "Umm al-Qura"
        DUBAI = "Dubai", "Dubai"
        MOONSIGHTING_COMMITTEE = "MoonsightingCommittee", "Moonsighting Committee"
        NORTH_AMERICA = "NorthAmerica", "North America"
        KUWAIT = "Kuwait", "Kuwait"
        QATAR = "Qatar", "Qatar"
        SINGAPORE = "Singapore", "Singapore"
        TEHRAN = "Tehran", "Tehran"
        TURKEY = "Turkey", "Turkey"

    class AsrMethod(models.TextChoices):
        STANDARD = "standard", "Standard (Shafiʿi)"
        HANAFI = "hanafi", "Hanafi"

    device = models.OneToOneField(
        "core.Device",
        on_delete=models.CASCADE,
        related_name="settings",
        primary_key=True,
    )
    auto_silent_enabled = models.BooleanField(default=True)
    radius_m = models.PositiveIntegerField(default=150)
    poll_interval_s = models.PositiveIntegerField(default=300)
    theme = models.CharField(
        max_length=10,
        choices=Theme.choices,
        default=Theme.SYSTEM,
    )
    prayer_method = models.CharField(
        max_length=32,
        choices=PrayerMethod.choices,
        default=PrayerMethod.MUSLIM_WORLD_LEAGUE,
    )
    asr_method = models.CharField(
        max_length=10,
        choices=AsrMethod.choices,
        default=AsrMethod.STANDARD,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    # Client-authoritative mutation time (see class doc); deliberately not
    # auto_now, so F-07.2 can reconcile by the value the client supplies.
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name_plural = "device settings"

    def __str__(self) -> str:
        return f"settings for {self.device_id}"
