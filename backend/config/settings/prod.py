"""
Production settings for the Sakina backend.

Hardens the base configuration: DEBUG is forced off, the insecure dev secret is
rejected, CORS is locked to an explicit allowlist, and standard TLS/cookie
security headers are enabled. Activate with::

    DJANGO_SETTINGS_MODULE=config.settings.prod
"""

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403
from .base import SECRET_KEY, env

# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------
# DEBUG must never be on in production, regardless of the environment.
DEBUG = False

# Refuse to boot with the insecure development secret.
if SECRET_KEY == "dev-insecure-secret-key-change-me":
    raise ImproperlyConfigured(
        "SECRET_KEY must be set to a real value in production. Generate one with "
        '`python -c "from django.core.management.utils import get_random_secret_key; '
        'print(get_random_secret_key())"`.'
    )

# ALLOWED_HOSTS is required in production — no wildcard fallback.
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS")
if not ALLOWED_HOSTS or "*" in ALLOWED_HOSTS:
    raise ImproperlyConfigured(
        "ALLOWED_HOSTS must be an explicit, non-wildcard list in production."
    )

# ---------------------------------------------------------------------------
# CORS — explicit allowlist only, never a wildcard.
# ---------------------------------------------------------------------------
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])

# ---------------------------------------------------------------------------
# Django REST Framework — JSON only (no browsable API in production).
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
}

# ---------------------------------------------------------------------------
# Security hardening
# ---------------------------------------------------------------------------
# Terminate TLS at the proxy/load balancer and trust the forwarded scheme.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)

# HSTS — default to one year; opt out via env if a host can't guarantee TLS yet.
SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=60 * 60 * 24 * 365)
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
