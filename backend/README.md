# Sakina Backend

Django REST Framework backend for the Sakina app. A runnable skeleton with
split per-environment settings (dev/prod), 12-factor env-based configuration,
a health-check endpoint, the anonymous device-ID flow, and nearby-mosque
discovery (`GET /mosques`, Geoapify-backed).

## Layout

```
backend/
├── config/
│   ├── settings/      # Split settings: base.py + dev.py + prod.py
│   ├── urls.py
│   └── wsgi.py / asgi.py
├── core/              # Core app (health check; future shared bits)
├── manage.py
├── requirements.txt
├── .env.example       # Copy to .env for local config
├── Dockerfile
└── docker-compose.yml # Local Django + Postgres
```

## Quick start (local, SQLite)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver
```

Then verify the API is up:

```bash
curl http://127.0.0.1:8000/health
# {"status": "ok", "service": "sakina-backend"}
```

## Configuration

### Settings layout (chosen pattern)

Settings are **split per environment** under `config/settings/`, selected via
the `DJANGO_SETTINGS_MODULE` environment variable:

| Module | Use | Notes |
|---|---|---|
| `config.settings.base` | shared | 12-factor, env-driven (django-environ). Never loaded directly. |
| `config.settings.dev` | local development | **Default** (set in `manage.py`/`wsgi.py`/`asgi.py`). `DEBUG=True`, permissive CORS. |
| `config.settings.prod` | production | `DEBUG=False` forced, strict CORS allowlist, TLS/HSTS/secure-cookie hardening, rejects the insecure dev secret. |

All environments standardize on **django-environ** for reading configuration;
`base.py` defines a single `env` instance the other modules reuse.

Run with production settings:

```bash
DJANGO_SETTINGS_MODULE=config.settings.prod gunicorn config.wsgi:application
```

### Environment variables (see `.env.example`)

| Variable | Default | Purpose |
|---|---|---|
| `DJANGO_SETTINGS_MODULE` | `config.settings.dev` | Which settings module to load. |
| `DEBUG` | `True` (dev) / forced `False` (prod) | Django debug mode. |
| `SECRET_KEY` | insecure dev key | Django secret. **Required** in prod (boot fails otherwise). |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | Comma-separated hosts. **Required & non-wildcard** in prod. |
| `DATABASE_URL` | SQLite file | e.g. `postgres://user:pass@host:5432/db`. |
| `CORS_ALLOW_ALL_ORIGINS` | `True` (dev) / forced `False` (prod) | Allow any origin. |
| `CORS_ALLOWED_ORIGINS` | empty | Explicit origins; the only CORS source in prod. |
| `SECURE_SSL_REDIRECT` | `True` (prod) | Redirect HTTP→HTTPS. |
| `SECURE_HSTS_SECONDS` | `31536000` (prod) | HSTS max-age; `0` to disable. |
| `GEOAPIFY_API_KEY` | empty | Server-side key for `GET /mosques` (EPIC-02). Without it the Overpass fallback is used. |
| `GEOAPIFY_TIMEOUT_S` | `15` | Geoapify request timeout (FR-2.3). |
| `OVERPASS_API_URL` | `overpass-api.de` | Keyless OSM fallback used when Geoapify fails / is over quota. |
| `OVERPASS_TIMEOUT_S` | `25` | Overpass request timeout. |
| `MOSQUE_SEARCH_RADIUS_M` | `5000` | Fixed nearby-search radius in metres (FR-2.1); client never controls it. |
| `MOSQUE_TILE_TTL_DAYS` | `30` | How long a cached map tile stays fresh before re-fetching from the provider (F-02.8). |

The database defaults to a local SQLite file so the project runs with zero
setup. Per the PRD (§7.3) we start DB-light (Path B) and can move to
Postgres/PostGIS later just by setting `DATABASE_URL`.

## Docker (Django + Postgres)

```bash
cd backend
docker compose up --build
# API on http://localhost:8000, Postgres on localhost:5432
```

## Tests

```bash
python manage.py test
```

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness probe → `{"status": "ok"}` |
| `GET` | `/mosques?lat=&lng=` | Nearby mosques sorted by haversine distance. Served from a per-tile DB cache (F-02.8), refreshed from the provider (Geoapify primary, Overpass fallback) only on a tile miss/stale. Radius is fixed server-side via `MOSQUE_SEARCH_RADIUS_M` (default 5000 m); not client-controlled. |
| `POST` | `/mosques/reports` | Flag a mosque as incorrect (FR-2.6). Stores a moderated `MosqueReport` (status `pending`); never edits the provider-owned mosque cache. Body: `mosque_id`, `lat`, `lng` (required), optional `name`/`reason`/`note`. Attributed to the `X-Device-Id` device when present, but succeeds anonymously. |
| `GET`/`PUT` | `/devices/{id}/settings` | Read or upsert this device's settings (F-07.1). `{id}` must match the `X-Device-Id` header. `GET` materialises server defaults on first read; `PUT` is a partial upsert. |
| | `/admin/` | Django admin |
