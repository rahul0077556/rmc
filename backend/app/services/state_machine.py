import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from backend.app.extensions import db
from backend.app.models.models import (
    PurchaseOrder, Trip, Invoice, AuditLog, Truck, Driver
)

class StateMachineError(Exception):
    def __init__(self, message: str, status_code: int = 409):
        super().__init__(message)
        self.message = message
        self.status_code = status_code

class StateMachine:
    # --- ALLOWED TRANSITIONS ---
    PO_TRANSITIONS = {
        "DRAFT": ["SUBMITTED", "CANCELLED"],
        "SUBMITTED": ["APPROVED", "REJECTED", "CANCELLED"],
        "REJECTED": ["SUBMITTED", "DRAFT", "CANCELLED"],
        "APPROVED": ["IN_PROGRESS", "CANCELLED"],
        "IN_PROGRESS": ["COMPLETED", "CANCELLED"],
        "COMPLETED": [],
        "CANCELLED": []
    }

    TRIP_TRANSITIONS = {
        "PLANNED": ["SENT_TO_PRODUCTION", "CANCELLED"],
        "SENT_TO_PRODUCTION": ["BATCHING", "CANCELLED"],
        "BATCHING": ["LOADED", "CANCELLED"],
        "LOADED": ["QC_PENDING", "CANCELLED"],
        "QC_PENDING": ["QC_APPROVED", "QC_REJECTED", "CANCELLED"],
        "QC_REJECTED": ["CORRECTING", "REPLACED", "CANCELLED"],
        "CORRECTING": ["QC_PENDING", "CANCELLED"],
        "QC_APPROVED": ["DISPATCHED", "CANCELLED"],
        "DISPATCHED": ["IN_TRANSIT", "DELIVERED", "CANCELLED"],
        "IN_TRANSIT": ["DELIVERED", "CANCELLED"],
        "DELIVERED": [],
        "REPLACED": [],
        "CANCELLED": []
    }

    INVOICE_TRANSITIONS = {
        "DRAFT": ["ISSUED", "CANCELLED"],
        "ISSUED": ["PARTIALLY_PAID", "PAID", "CANCELLED"],
        "PARTIALLY_PAID": ["PAID", "CANCELLED"],
        "PAID": [],
        "CANCELLED": []
    }

    @staticmethod
    def log_audit(user_id: Optional[str], action: str, entity: str, entity_id: str, before: Any, after: Any):
        audit = AuditLog(
            user_id=user_id,
            action=action,
            entity=entity,
            entity_id=entity_id,
            before_data=json.dumps(before) if before is not None else None,
            after_data=json.dumps(after) if after is not None else None,
            created_at=datetime.now(timezone.utc)
        )
        db.session.add(audit)
        db.session.flush()

    @staticmethod
    def transition_po(po: PurchaseOrder, new_status: str, user_id: Optional[str], remarks: Optional[str] = None):
        current_status = po.status
        allowed = StateMachine.PO_TRANSITIONS.get(current_status, [])
        if new_status not in allowed:
            raise StateMachineError(
                f"Invalid PO status transition from '{current_status}' to '{new_status}'. Allowed: {allowed}"
            )
        
        before = {"status": current_status}
        po.status = new_status
        if new_status == "SUBMITTED":
            po.submitted_at = datetime.now(timezone.utc)
        elif new_status == "APPROVED":
            po.approved_at = datetime.now(timezone.utc)
            po.approved_by = user_id
            po.approval_remarks = remarks
        elif new_status == "REJECTED":
            po.rejection_reason = remarks
        elif new_status == "CANCELLED":
            po.cancel_reason = remarks

        StateMachine.log_audit(
            user_id=user_id,
            action=f"PO_STATUS_{new_status}",
            entity="PurchaseOrder",
            entity_id=po.id,
            before=before,
            after={"status": new_status, "remarks": remarks}
        )
        db.session.flush()

    @staticmethod
    def transition_trip(trip: Trip, new_status: str, user_id: Optional[str], extra_data: Optional[Dict[str, Any]] = None):
        current_status = trip.status
        allowed = StateMachine.TRIP_TRANSITIONS.get(current_status, [])
        if new_status not in allowed:
            raise StateMachineError(
                f"Invalid Trip status transition from '{current_status}' to '{new_status}'. Allowed: {allowed}"
            )

        # BUSINESS RULE 4: Dispatch release is impossible without QC approval
        if new_status == "DISPATCHED" and current_status != "QC_APPROVED":
            raise StateMachineError(
                f"Cannot release Trip {trip.trip_number}: Release requires QC approval ('QC_APPROVED'). Current status is '{current_status}'."
            )

        before = {"status": current_status}
        trip.status = new_status

        if new_status == "DISPATCHED":
            trip.dispatched_at = datetime.now(timezone.utc)
            # Update truck status
            if trip.truck:
                trip.truck.status = "IN_TRANSIT"
            if trip.driver:
                trip.driver.status = "ASSIGNED"
        elif new_status == "IN_TRANSIT":
            if trip.truck:
                trip.truck.status = "IN_TRANSIT"
        elif new_status == "DELIVERED":
            trip.delivered_at = datetime.now(timezone.utc)
            if extra_data:
                trip.delivered_quantity = extra_data.get("delivered_quantity", trip.quantity_cum)
                trip.receiver_name = extra_data.get("receiver_name")
            else:
                trip.delivered_quantity = trip.quantity_cum
            
            # Free up truck and driver
            if trip.truck:
                trip.truck.status = "AVAILABLE"
            if trip.driver:
                trip.driver.status = "AVAILABLE"

            # Check if PO completed
            po = trip.po
            if po and po.delivered_quantity >= po.quantity_cum:
                po.status = "COMPLETED"

        elif new_status in ["CANCELLED", "REPLACED"]:
            if trip.truck:
                trip.truck.status = "AVAILABLE"
            if trip.driver:
                trip.driver.status = "AVAILABLE"

        StateMachine.log_audit(
            user_id=user_id,
            action=f"TRIP_STATUS_{new_status}",
            entity="Trip",
            entity_id=trip.id,
            before=before,
            after={"status": new_status, "extra": extra_data}
        )
        db.session.flush()

    @staticmethod
    def transition_invoice(invoice: Invoice, new_status: str, user_id: Optional[str]):
        current_status = invoice.status
        allowed = StateMachine.INVOICE_TRANSITIONS.get(current_status, [])
        if new_status not in allowed:
            raise StateMachineError(
                f"Invalid Invoice status transition from '{current_status}' to '{new_status}'. Allowed: {allowed}"
            )
        
        before = {"status": current_status}
        invoice.status = new_status
        StateMachine.log_audit(
            user_id=user_id,
            action=f"INVOICE_STATUS_{new_status}",
            entity="Invoice",
            entity_id=invoice.id,
            before=before,
            after={"status": new_status}
        )
        db.session.flush()
