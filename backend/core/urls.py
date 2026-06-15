"""URL routes for the core app."""

from django.urls import path

from . import views

urlpatterns = [
    path("health", views.health, name="health"),
    path("mosques", views.mosques, name="mosques"),
    path("pins", views.pins, name="pins"),
    path("pins/<uuid:pin_id>", views.pin_detail, name="pin-detail"),
]
