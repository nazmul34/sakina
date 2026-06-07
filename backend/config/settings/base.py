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
