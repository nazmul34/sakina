"""Admin registrations for the core app."""

from django.contrib import admin

from .models import Device, FetchedTile, Mosque


@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ("device_id", "linked_user", "created_at", "updated_at", "deleted_at")
    list_filter = ("created_at", "deleted_at")
    search_fields = ("device_id",)
    readonly_fields = ("device_id", "created_at", "updated_at")

    def get_queryset(self, request):
        # Surface soft-deleted devices in the admin too, not just live ones.
        return Device.all_objects.all()


@admin.register(Mosque)
class MosqueAdmin(admin.ModelAdmin):
    list_display = ("name", "source", "external_id", "lat", "lng", "updated_at")
    list_filter = ("source",)
    search_fields = ("name", "external_id")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(FetchedTile)
class FetchedTileAdmin(admin.ModelAdmin):
    list_display = ("tile_id", "fetched_at", "source")
    list_filter = ("source", "fetched_at")
    search_fields = ("tile_id",)
    readonly_fields = ("created_at", "updated_at")
