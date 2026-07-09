"""
Base settings shared by all environments for the Sakina backend.

Configuration is environment-driven (12-factor): values are read from
environment variables, with a local ``.env`` file loaded for development.
See ``.env.example`` for the full list of supported variables.

Do not use this module directly. Select an environment-specific module via
``DJANGO_SETTINGS_MODULE``:

* ``config.settings.dev``  — local development (the default)
* ``config.settings.prod`` — production (DEBUG off, strict CORS, TLS hardening)
"""

from pathlib import Path

import environ
from django.db.backends.signals import connection_created

# backend/ — the directory that holds manage.py.
# This file is backend/config/settings/base.py, so go up three levels.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
env = environ.Env()

# Load a .env file if present (development convenience; ignored in prod where
# real environment variables are provided by the platform).
environ.Env.read_env(BASE_DIR / ".env")

# DEBUG and CORS posture are set by the dev/prod modules. Everything else that
# is genuinely shared lives here.
SECRET_KEY = env("SECRET_KEY", default="dev-insecure-secret-key-change-me")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "corsheaders",
    # Local
    "core",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    # Resolve the anonymous device identity (F-00.4) after auth, so a future
    # linked_user can be associated using request.user.
    "core.middleware.DeviceIdMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
# Defaults to a local SQLite file so the project runs with zero setup.
# Set DATABASE_URL (e.g. postgres://user:pass@host:5432/db) to use Postgres.
DATABASES = {
    "default": env.db(
        "DATABASE_URL",
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
    ),
}


# SQLite is the production default (a single file on the VM, backed up to R2), so
# tune it for a small concurrent web workload: WAL lets reads run alongside a
# write, and a busy timeout makes a briefly-locked write wait rather than fail
# with "database is locked". Applied to every new SQLite connection; a no-op on
# other engines (e.g. if DATABASE_URL later points at Postgres).
def _configure_sqlite(connection, **kwargs):
    if connection.vendor == "sqlite":
        cursor = connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA synchronous=NORMAL;")
        cursor.execute("PRAGMA busy_timeout=5000;")


connection_created.connect(_configure_sqlite)

# ---------------------------------------------------------------------------
# Password validation
# ---------------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ---------------------------------------------------------------------------
# Internationalization
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static files
# ---------------------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
}

# ---------------------------------------------------------------------------
# MasjidNearMe — primary nearby-mosque source (EPIC-02, FR-2.5)
# ---------------------------------------------------------------------------
# Community masjid DB with strong coverage where OSM is sparse (e.g. Bangladesh).
# Keyless; its `radius` is advisory so the provider filters to the search radius.
MASJIDNEARME_API_URL = env(
    "MASJIDNEARME_API_URL", default="https://api.masjidnear.me/v1/masjids/search"
)
MASJIDNEARME_TIMEOUT_S = env.int("MASJIDNEARME_TIMEOUT_S", default=15)

# ---------------------------------------------------------------------------
# Geoapify Places — nearby-mosque source (EPIC-02, FR-2.5)
# ---------------------------------------------------------------------------
# Server-side only; never exposed to the client. Get a key at geoapify.com and
# set GEOAPIFY_API_KEY in .env (dev) / the platform env (prod). Restrict the key
# to the server IP once deployed. GEOAPIFY_TIMEOUT_S backs the FR-2.3 15s budget.
GEOAPIFY_API_KEY = env("GEOAPIFY_API_KEY", default="")
GEOAPIFY_TIMEOUT_S = env.int("GEOAPIFY_TIMEOUT_S", default=15)

# Overpass — keyless OSM fallback used when Geoapify fails or is over quota
# (F-02.2). Also keeps /mosques working in dev before a Geoapify key is set.
OVERPASS_API_URL = env("OVERPASS_API_URL", default="https://overpass-api.de/api/interpreter")
OVERPASS_TIMEOUT_S = env.int("OVERPASS_TIMEOUT_S", default=25)

# Nearby-mosque search radius in metres (FR-2.1). Fixed server-side: the client
# never supplies or controls it, so "nearby" stays consistent. Kept ≤ the ~1.25 km
# tile fetch radius (#47 cache) so a single covering-tile fetch fully satisfies a
# query — a larger search would return incomplete results. Tunable via env.
MOSQUE_SEARCH_RADIUS_M = env.int("MOSQUE_SEARCH_RADIUS_M", default=1000)

# How long a fetched map tile stays fresh before the next request re-queries the
# provider (F-02.8, #47). Mosque locations rarely change, so the default is
# generous to keep provider calls (and cost) low.
MOSQUE_TILE_TTL_DAYS = env.int("MOSQUE_TILE_TTL_DAYS", default=30)
