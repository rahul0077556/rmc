import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from backend.app.extensions import db
from backend.app.models.models import NotificationLog

class NotificationService:
    @staticmethod
    def send_whatsapp(
        recipient: str,
        template: str,
        payload_data: Dict[str, Any],
        related_trip_id: Optional[str] = None,
        related_po_id: Optional[str] = None,
        created_by: Optional[str] = None
    ) -> NotificationLog:
        """
        Mock implementation of WhatsApp Business API.
        Writes to notification_log table with status SENT.
        """
        log_entry = NotificationLog(
            channel="whatsapp_simulated",
            recipient=recipient,
            template=template,
            payload=json.dumps(payload_data),
            status="SENT",
            sent_at=datetime.now(timezone.utc),
            related_trip_id=related_trip_id,
            related_po_id=related_po_id,
            created_by=created_by
        )
        db.session.add(log_entry)
        db.session.flush()
        return log_entry
