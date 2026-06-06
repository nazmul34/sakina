# Sakina Backend

Django REST Framework backend for the Sakina app. This is the basic scaffold
(issue #1): a runnable skeleton with env-based settings and a health-check
endpoint. No domain models, auth, or feature endpoints yet.

## Layout

```
backend/
├── config/            # Django project (settings, urls, wsgi/asgi)
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

Settings are environment-driven (see `.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `DEBUG` | `False` | Django debug mode. `True` for local dev only. |
| `SECRET_KEY` | insecure dev key | Django secret. Set a real one outside local dev. |
| `ALLOWED_HOSTS` | `*` | Comma-separated allowed hosts. |
| `DATABASE_URL` | SQLite file | e.g. `postgres://user:pass@host:5432/db`. |
| `CORS_ALLOW_ALL_ORIGINS` | `True` | Allow any origin (dev). Set `False` in prod. |
| `CORS_ALLOWED_ORIGINS` | empty | Explicit origins when not allowing all. |

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
| | `/admin/` | Django admin |
