#!/bin/sh
set -e

echo "=== RMC Enterprise Backend Bootstrapping ==="

# Auto-initialize and seed database if completely empty
python -c "
import os
from backend.app import create_app
from backend.app.extensions import db
from backend.app.models.models import User, Plant, Customer
from backend.purge_dummy_data import execute_purge

app = create_app()
with app.app_context():
    db.create_all()
    user_count = User.query.count()
    plant_count = Plant.query.count()
    cust_count = Customer.query.count()
    if plant_count == 0 or user_count == 0 or cust_count == 0:
        print('Plant database uninitialized or missing baseline masters. Bootstrapping baseline enterprise dataset...')
        execute_purge()
    else:
        print(f'Database verified: {plant_count} plants, {user_count} users, {cust_count} customers. Preserving all tenant data.')
"

PORT="${PORT:-8080}"
echo "=== Starting Gunicorn Production Server on port ${PORT} ==="
exec gunicorn --bind "0.0.0.0:${PORT}" --workers 2 --timeout 120 "backend.wsgi:app"
