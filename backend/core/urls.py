"""URL routes for the core app."""

from django.conf import settings
from django.urls import path

from . import dev_views, views

urlpatterns = [
    path("health", views.health, name="health"),
    path("mosques", views.mosques, name="mosques"),
    path("messages/random", views.random_message, name="messages-random"),
    path("pins", views.pins, name="pins"),
    path("pins/<uuid:pin_id>", views.pin_detail, name="pin-detail"),
    path(
        "devices/<uuid:device_id>/settings",
        views.device_settings,
        name="device-settings",
    ),
]

# Dev-only APK download helper (see core/dev_views.py). Registered only when
# DEBUG is on, so the routes don't even exist in production; the views also
# hard-gate on DEBUG as a second line of defence.
if settings.DEBUG:
    urlpatterns += [
        path("dev/apk", dev_views.apk_index, name="dev-apk-index"),
        path("dev/apk/download", dev_views.apk_download, name="dev-apk-download"),
    ]
