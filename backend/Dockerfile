FROM python:3.12-slim

# Keep Python from writing .pyc files and buffering stdout/stderr.
# The image defaults to production settings; override DJANGO_SETTINGS_MODULE
# (e.g. config.settings.dev) for non-prod use such as the local compose stack.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings.prod

WORKDIR /app

# System deps for psycopg2 (Postgres) at build time.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first to leverage Docker layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Collect static + run migrations at start, then serve via Gunicorn.
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:8000"]
