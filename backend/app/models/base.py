import uuid
from datetime import datetime, timezone
from backend.app.extensions import db

def generate_uuid():
    return uuid.uuid4().hex

class TimestampMixin:
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(
        db.DateTime, 
        default=lambda: datetime.now(timezone.utc), 
        onupdate=lambda: datetime.now(timezone.utc), 
        nullable=False
    )
    created_by = db.Column(db.String(36), nullable=True)
