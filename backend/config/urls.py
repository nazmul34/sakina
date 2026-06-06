"""Root URL configuration for the Sakina backend."""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    # Core endpoints (health check, etc.)
    path("", include("core.urls")),
]
