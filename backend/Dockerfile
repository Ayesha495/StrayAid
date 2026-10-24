FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DJANGO_SETTINGS_MODULE=config.settings

WORKDIR /app

# libpq for psycopg2, image libraries for Pillow.
RUN apt-get update && apt-get install -y --no-install-recommends libpq5 libjpeg62-turbo zlib1g \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Free animal-detection model (SSD-MobileNet v1, ONNX Model Zoo), checksum-verified.
# Build-only settings: nothing here touches the database or needs real secrets.
RUN DEBUG=1 python manage.py download_ai_model \
    && DJANGO_SECRET_KEY=build-only python manage.py collectstatic --noinput

# Run as an unprivileged user; only uploaded media needs to be writable.
RUN useradd --create-home --uid 1000 strayaid && mkdir -p /app/media && chown -R strayaid /app/media
USER strayaid

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health/', timeout=4)"

CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers ${WEB_CONCURRENCY:-2} --timeout 120 --access-logfile -"]
