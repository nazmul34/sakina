"""Admin registrations for the core app."""

from django.contrib import admin

from .models import (
    Device,
    DeviceSettings,
    FetchedTile,
    IslamicMessage,
    Mosque,
    MosqueReport,
    Pin,
)


@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ("device_id", "linked_user", "created_at", "updated_at", "deleted_at")
    list_filter = ("created_at", "deleted_at")
    search_fields = ("device_id",)
    readonly_fields = ("device_id", "created_at", "updated_at")

    def get_queryset(self, request):
        # Surface soft-deleted devices in the admin too, not just live ones.
        return Device.all_objects.all()


@admin.register(DeviceSettings)
class DeviceSettingsAdmin(admin.ModelAdmin):
    list_display = (
        "device",
        "auto_silent_enabled",
        "radius_m",
        "theme",
        "prayer_method",
        "asr_method",
        "updated_at",
    )
    list_filter = ("theme", "auto_silent_enabled", "prayer_method", "asr_method")
    search_fields = ("device__device_id",)
    readonly_fields = ("device", "created_at")


@admin.register(Mosque)
class MosqueAdmin(admin.ModelAdmin):
    list_display = ("name", "source", "external_id", "lat", "lng", "updated_at")
    list_filter = ("source",)
    search_fields = ("name", "external_id")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(MosqueReport)
class MosqueReportAdmin(admin.ModelAdmin):
    list_display = (
        "mosque_name",
        "mosque_public_id",
        "reason",
        "status",
        "device",
        "created_at",
    )
    list_filter = ("status", "reason", "created_at")
    search_fields = ("mosque_name", "mosque_public_id", "note")
    list_editable = ("status",)
    readonly_fields = (
        "id",
        "device",
        "mosque_public_id",
        "mosque_name",
        "lat",
        "lng",
        "reason",
        "note",
        "created_at",
        "updated_at",
    )


@admin.register(FetchedTile)
class FetchedTileAdmin(admin.ModelAdmin):
    list_display = ("tile_id", "fetched_at", "source")
    list_filter = ("source", "fetched_at")
    search_fields = ("tile_id",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(IslamicMessage)
class IslamicMessageAdmin(admin.ModelAdmin):
    list_display = ("source_label", "category", "is_active", "text_preview")
    list_filter = ("category", "is_active")
    search_fields = ("text", "source_label")
    readonly_fields = ("id",)

    @admin.display(description="Text")
    def text_preview(self, obj):
        return obj.text[:80] + ("…" if len(obj.text) > 80 else "")


@admin.register(Pin)
class PinAdmin(admin.ModelAdmin):
    list_display = ("label", "device", "lat", "lng", "radius_m", "updated_at", "deleted_at")
    list_filter = ("deleted_at", "created_at")
    search_fields = ("label", "device__device_id")
    readonly_fields = ("id", "created_at")

    def get_queryset(self, request):
        # Surface soft-deleted pins (tombstones) in the admin too.
        return Pin.all_objects.select_related("device")
