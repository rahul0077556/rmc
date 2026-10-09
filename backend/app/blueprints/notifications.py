import json
from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from backend.app.models.models import NotificationLog
from backend.app.utils.responses import success_response
from backend.app.utils.decorators import roles_required

notifications_bp = Blueprint("notifications", __name__, url_prefix="/api/v1/notifications")

@notifications_bp.route("", methods=["GET"])
@jwt_required()
@roles_required()
def list_notifications():
    po_id = request.args.get("poId")
    trip_id = request.args.get("tripId")

    query = NotificationLog.query
    if po_id:
        query = query.filter_by(related_po_id=po_id)
    if trip_id:
        query = query.filter_by(related_trip_id=trip_id)

    logs = query.order_by(NotificationLog.sent_at.desc()).limit(100).all()
    results = []
    for l in logs:
        item = l.to_dict()
        try:
            item["payloadData"] = json.loads(l.payload)
        except Exception:
            item["payloadData"] = l.payload
        results.append(item)

    return success_response(data=results)
