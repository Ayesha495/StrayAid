FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps needed for psycopg2, Pillow, and cryptography
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    libffi-dev \
    libjpeg-dev \
    libpng-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-docker.txt .
RUN pip install -r requirements-docker.txt

COPY StrayAid_backend/ .

# Free animal-detection model (SSD-MobileNet v1, ONNX Model Zoo), checksum-verified.
# Plain settings are enough here: the command doesn't touch the database.
RUN python manage.py download_ai_model --settings=StrayAid_backend.settings

# Collect static files at build time
RUN python manage.py collectstatic --noinput --settings=StrayAid_backend.settings_docker 2>/dev/null || true

EXPOSE 8000

CMD ["gunicorn", "StrayAid_backend.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "3", \
     "--timeout", "120", \
     "--access-logfile", "-"]
