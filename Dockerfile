FROM python:3.12-slim

WORKDIR /app

# Install system dependencies including PostgreSQL client libraries and curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ backend/

# Set Python environment variables
ENV PYTHONPATH=/app
ENV FLASK_APP=backend.wsgi:app
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

RUN chmod +x /app/backend/entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/app/backend/entrypoint.sh"]
