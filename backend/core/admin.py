"""Admin registrations for the core app."""

from django.contrib import admin

from .models import Device


@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ("device_id", "linked_user", "created_at", "updated_at", "deleted_at")
    list_filter = ("created_at", "deleted_at")
    search_fields = ("device_id",)
    readonly_fields = ("device_id", "created_at", "updated_at")

    def get_queryset(self, request):
        # Surface soft-deleted devices in the admin too, not just live ones.
        return Device.all_objects.all()
