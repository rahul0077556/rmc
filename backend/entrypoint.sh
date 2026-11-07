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
    from backend.app.models.models import Customer
    cust_count = Customer.query.count()
    if not user or not user.check_password('Demo@123') or cust_count == 0:
        print('Core users or baseline enterprise customers missing. Bootstrapping clean plant database...')
        execute_purge()
    else:
        print('Core users and baseline enterprise customers verified.')
"

PORT="${PORT:-8080}"
echo "=== Starting Gunicorn Production Server on port ${PORT} ==="
exec gunicorn --bind "0.0.0.0:${PORT}" --workers 2 --timeout 120 "backend.wsgi:app"
