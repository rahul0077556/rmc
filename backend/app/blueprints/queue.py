from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.app.models.models import User
from backend.app.services.queue_service import QueueService
from backend.app.utils.responses import success_response
from backend.app.utils.decorators import get_scoped_plant_id

queue_bp = Blueprint("queue", __name__, url_prefix="/api/v1/queue")

@queue_bp.route("", methods=["GET"])
@jwt_required(optional=True)
def get_live_queue():
    user_id = get_jwt_identity()
    user = User.query.get(user_id) if user_id else None
    requested_role = request.args.get("role")
    scoped_plant = get_scoped_plant_id()
    
    role = requested_role or (user.role if user else "production")
    items = QueueService.get_queue_for_role(role, plant_id=scoped_plant)
    
    return success_response(data=items)

@queue_bp.route("/summary", methods=["GET"])
@jwt_required(optional=True)
def get_queue_summary():
    scoped_plant = get_scoped_plant_id()
    summary = QueueService.get_queue_summary(plant_id=scoped_plant)
    return success_response(data=summary)
