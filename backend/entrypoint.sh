#!/bin/sh
set -e

echo "=== RMC Enterprise Backend Bootstrapping ==="

# Auto-initialize and seed database if empty
python -c "
import os
from backend.app import create_app
from backend.app.extensions import db
from backend.app.models.models import User

app = create_app()
with app.app_context():
    db.create_all()
    user_count = User.query.count()
    print(f'Current users in database: {user_count}')
    if user_count == 0:
        print('Database is empty. Seeding initial records...')
        from backend.commands.seed import seed_cli
        from click.testing import CliRunner
        runner = CliRunner()
        result = runner.invoke(seed_cli)
        print('Seed completed with exit code:', result.exit_code)
" || true

PORT="${PORT:-8080}"
echo "=== Starting Gunicorn Production Server on port ${PORT} ==="
exec gunicorn --bind "0.0.0.0:${PORT}" --workers 2 --timeout 120 "backend.wsgi:app"
