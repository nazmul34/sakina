"""Core views for the Sakina backend."""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
def health(_request: Request) -> Response:
    """Liveness probe used to verify the API is running.

    Returns a small JSON payload so uptime monitors (and humans) can confirm
    the service is up without touching the database.
    """
    return Response({"status": "ok", "service": "sakina-backend"})
