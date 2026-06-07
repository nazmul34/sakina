"""
Settings package for the Sakina backend.

Settings are split per environment. Select one via ``DJANGO_SETTINGS_MODULE``:

* ``config.settings.dev``  — local development (default; see ``manage.py``)
* ``config.settings.prod`` — production

Both build on ``config.settings.base``, which holds the shared, env-driven
(12-factor) configuration. See ``.env.example`` for supported variables.
"""
