"""
Development settings for the Sakina backend.

This is the default ``DJANGO_SETTINGS_MODULE`` (see ``manage.py``). It favours
developer convenience: DEBUG on by default and permissive CORS so the mobile
app / browser tooling can talk to the API without extra setup. Every value is
still overridable via the environment / ``.env``.
"""

from .base import *  # noqa: F401,F403
from .base import env

DEBUG = env.bool("DEBUG", default=True)

# In development we allow all origins by default for convenience.
CORS_ALLOW_ALL_ORIGINS = env.bool("CORS_ALLOW_ALL_ORIGINS", default=True)
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])
