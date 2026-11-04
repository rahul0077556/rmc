#!/bin/sh
set -e

echo "=== RMC Enterprise Backend Bootstrapping ==="

# Auto-initialize and seed database if empty
python -c "
import os
from backend.app import create_app
from backend.app.extensions import db
from backend.app.models.models import User
from backend.purge_dummy_data import execute_purge

app = create_app()
with app.app_context():
    db.create_all()
    user = User.query.filter_by(email='sales@rmc.test').first()
    if not user or not user.check_password('Demo@123'):
        print('Core users missing or invalid. Bootstrapping clean plant database...')
        execute_purge()
    else:
        print('Core users verified.')
"

PORT="${PORT:-8080}"
echo "=== Starting Gunicorn Production Server on port ${PORT} ==="
exec gunicorn --bind "0.0.0.0:${PORT}" --workers 2 --timeout 120 "backend.wsgi:app"
