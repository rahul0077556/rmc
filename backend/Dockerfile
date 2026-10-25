FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Place files in /app/backend so backend.wsgi import works properly
COPY . /app/backend/

ENV PYTHONPATH=/app
ENV FLASK_APP=backend.wsgi:app
ENV PYTHONUNBUFFERED=1
ENV PORT=5001

RUN chmod +x /app/backend/entrypoint.sh

EXPOSE 5001

ENTRYPOINT ["/app/backend/entrypoint.sh"]

