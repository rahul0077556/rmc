from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from backend.app.models.models import (
    PurchaseOrder, Trip, BatchSheet, QcCheck, Invoice, Material, Customer, Truck, Driver
)

class QueueService:
    @staticmethod
    def get_queue_for_role(role: str) -> List[Dict[str, Any]]:
        items = []
        now = datetime.now(timezone.utc)

        # 1. SALES MANAGER: Pending PO Approvals
        if role in ["sales_manager", "owner"]:
            pending_pos = PurchaseOrder.query.filter_by(status="SUBMITTED", is_deleted=False).all()
            for po in pending_pos:
                items.append({
                    "id": f"po-appr-{po.id}",
                    "role": "sales_manager",
                    "title": f"Approve PO: {po.po_number} ({po.quantity_cum} cum {po.grade.code if po.grade else 'M25'})",
                    "subtitle": f"{po.customer.name if po.customer else 'Customer'} · Site: {po.site.name if po.site else 'Site'} · Rate: ₹{po.rate_per_cum:,.0f}/cum",
                    "category": "Credit & Commercial Approval",
                    "urgency": "urgent",
                    "urgencyLabel": "Approval Required",
                    "badgeText": "Approval Pending",
                    "badgeVariant": "destructive",
                    "metrics": [
                        {"label": "Grade", "value": po.grade.code if po.grade else "M25"},
                        {"label": "Volume", "value": f"{po.quantity_cum} cum"},
                        {"label": "Est. Value", "value": f"₹{(po.quantity_cum * po.rate_per_cum * 1.18):,.0f}"}
                    ],
                    "actionLabel": "Review & Approve →",
                    "actionTo": "/sales/approvals",
                    "waitingTime": "Pending review",
                    "status": "pending",
                    "dueTime": "Before dispatch"
                })

        # 2. SALES OFFICER: Draft POs
        if role in ["sales", "owner"]:
            draft_pos = PurchaseOrder.query.filter_by(status="DRAFT", is_deleted=False).all()
            for po in draft_pos:
                items.append({
                    "id": f"po-draft-{po.id}",
                    "role": "sales",
                    "title": f"Submit Draft PO: {po.po_number} ({po.quantity_cum} cum)",
                    "subtitle": f"{po.customer.name if po.customer else 'Customer'} · Created: {po.created_at.strftime('%d-%b %H:%M')}",
                    "category": "Order Intake",
                    "urgency": "attention",
                    "urgencyLabel": "Draft Incomplete",
                    "badgeText": "Draft",
                    "badgeVariant": "warning",
                    "metrics": [
                        {"label": "Volume", "value": f"{po.quantity_cum} cum"},
                        {"label": "Customer", "value": po.customer.name if po.customer else "—"}
                    ],
                    "actionLabel": "Open & Submit →",
                    "actionTo": f"/sales/orders/{po.id}",
                    "waitingTime": "Draft",
                    "status": "pending"
                })

        # 3. DISPATCHER: Unplanned POs and Trips waiting for Challan Release
        if role in ["dispatcher", "owner"]:
            # A. Approved POs needing trip planning
            approved_pos = PurchaseOrder.query.filter(
                PurchaseOrder.status.in_(["APPROVED", "IN_PROGRESS"]),
                PurchaseOrder.is_deleted == False
            ).all()
            for po in approved_pos:
                if po.balance_quantity > 0:
                    items.append({
                        "id": f"disp-plan-{po.id}",
                        "role": "dispatcher",
                        "title": f"Plan Trips: {po.po_number} ({po.balance_quantity} cum balance)",
                        "subtitle": f"{po.customer.name if po.customer else 'Customer'} · Delivery: {po.delivery_datetime.strftime('%d-%b %H:%M')}",
                        "category": "Trip Planning",
                        "urgency": "urgent" if po.trip_count == 0 else "attention",
                        "urgencyLabel": "Schedule TM",
                        "badgeText": f"{po.balance_quantity} cum to plan",
                        "badgeVariant": "destructive" if po.trip_count == 0 else "warning",
                        "metrics": [
                            {"label": "Grade", "value": po.grade.code if po.grade else "M25"},
                            {"label": "Remaining", "value": f"{po.balance_quantity} cum"},
                            {"label": "Active Trips", "value": str(len(po.trips))}
                        ],
                        "actionLabel": "Plan Trips Now →",
                        "actionTo": f"/dispatcher/plan/{po.id}",
                        "waitingTime": "Awaiting schedule",
                        "status": "pending"
                    })

            # B. QC Approved Trips awaiting Challan Release
            qc_approved_trips = Trip.query.filter_by(status="QC_APPROVED").all()
            for trip in qc_approved_trips:
                items.append({
                    "id": f"disp-rel-{trip.id}",
                    "role": "dispatcher",
                    "title": f"Release Trip: {trip.trip_number} with Challan",
                    "subtitle": f"Truck {trip.truck.tm_number if trip.truck else 'TM'} · Driver {trip.driver.name if trip.driver else 'Driver'} · QC Approved",
                    "category": "Gate Release",
                    "urgency": "urgent",
                    "urgencyLabel": "Release Required",
                    "badgeText": "QC Passed",
                    "badgeVariant": "success",
                    "metrics": [
                        {"label": "Volume", "value": f"{trip.quantity_cum} cum"},
                        {"label": "Truck", "value": trip.truck.tm_number if trip.truck else "—"},
                        {"label": "PO", "value": trip.po.po_number if trip.po else "—"}
                    ],
                    "actionLabel": "Issue Challan & Release →",
                    "actionTo": "/dispatcher",
                    "waitingTime": "Loaded at plant",
                    "status": "pending"
                })

        # 4. PRODUCTION: Trips sent to plant waiting to be batched
        if role in ["production", "owner"]:
            queued_trips = Trip.query.filter_by(status="SENT_TO_PRODUCTION").order_by(Trip.sequence.asc()).all()
            for trip in queued_trips:
                items.append({
                    "id": f"prod-batch-{trip.id}",
                    "role": "production",
                    "title": f"Batch Next: {trip.trip_number} ({trip.quantity_cum} cum {trip.po.grade.code if trip.po and trip.po.grade else 'M25'})",
                    "subtitle": f"TM {trip.truck.tm_number if trip.truck else 'Pending'} · PO {trip.po.po_number if trip.po else 'PO'} · {trip.po.customer.name if trip.po and trip.po.customer else ''}",
                    "category": "Batching Queue",
                    "urgency": "urgent",
                    "urgencyLabel": "Plant Queue #1",
                    "badgeText": "Awaiting Batch",
                    "badgeVariant": "destructive",
                    "metrics": [
                        {"label": "Grade", "value": trip.po.grade.code if trip.po and trip.po.grade else "M25"},
                        {"label": "Volume", "value": f"{trip.quantity_cum} cum"},
                        {"label": "Truck", "value": trip.truck.tm_number if trip.truck else "Pending"}
                    ],
                    "actionLabel": "Start Batching Sequence →",
                    "actionTo": "/production",
                    "waitingTime": "Waiting for mixer",
                    "status": "pending"
                })

            batching_trips = Trip.query.filter_by(status="BATCHING").all()
            for trip in batching_trips:
                items.append({
                    "id": f"prod-active-{trip.id}",
                    "role": "production",
                    "title": f"Batch in Progress: {trip.trip_number}",
                    "subtitle": f"Automated weigh-hopper dosing active for {trip.truck.tm_number if trip.truck else 'TM'}",
                    "category": "Mixer Active",
                    "urgency": "attention",
                    "urgencyLabel": "Dosing",
                    "badgeText": "In Mixer",
                    "badgeVariant": "warning",
                    "metrics": [
                        {"label": "Volume", "value": f"{trip.quantity_cum} cum"},
                        {"label": "Batch", "value": trip.batch_sheet.batch_number if trip.batch_sheet else "Active"}
                    ],
                    "actionLabel": "Monitor Production →",
                    "actionTo": "/production",
                    "waitingTime": "In mixer",
                    "status": "pending"
                })

        # 5. QA / QC: Slump testing & QC approval
        if role in ["qa", "owner"]:
            qc_pending_trips = Trip.query.filter(Trip.status.in_(["LOADED", "QC_PENDING"])).all()
            for trip in qc_pending_trips:
                items.append({
                    "id": f"qa-check-{trip.id}",
                    "role": "qa",
                    "title": f"QC Slump Test: {trip.trip_number} ({trip.po.grade.code if trip.po and trip.po.grade else 'M25'})",
                    "subtitle": f"Truck {trip.truck.tm_number if trip.truck else 'TM'} batched. Verify slump cone, bleeding & mix design before dispatch release.",
                    "category": "Quality Inspection",
                    "urgency": "urgent",
                    "urgencyLabel": "Slump Test Required",
                    "badgeText": "Loaded - QC Pending",
                    "badgeVariant": "destructive",
                    "metrics": [
                        {"label": "Grade", "value": trip.po.grade.code if trip.po and trip.po.grade else "M25"},
                        {"label": "Batch No", "value": trip.batch_sheet.batch_number if trip.batch_sheet else "—"},
                        {"label": "Loaded Qty", "value": f"{trip.quantity_cum} cum"}
                    ],
                    "actionLabel": "Enter Slump & Approve →",
                    "actionTo": "/qa",
                    "waitingTime": "Awaiting QC",
                    "status": "pending"
                })

        # 6. SITE SUPERVISOR: In-transit trucks arriving at site
        if role in ["supervisor", "owner"]:
            in_transit_trips = Trip.query.filter_by(status="IN_TRANSIT").all()
            for trip in in_transit_trips:
                items.append({
                    "id": f"sup-transit-{trip.id}",
                    "role": "supervisor",
                    "title": f"Incoming Truck: {trip.truck.tm_number if trip.truck else 'TM'} ({trip.trip_number})",
                    "subtitle": f"Site: {trip.po.site.name if trip.po and trip.po.site else 'Site'} · Driver: {trip.driver.name if trip.driver else 'Driver'} ({trip.driver.phone if trip.driver else ''})",
                    "category": "Site Delivery",
                    "urgency": "urgent",
                    "urgencyLabel": "In Transit to Site",
                    "badgeText": "On Road",
                    "badgeVariant": "warning",
                    "metrics": [
                        {"label": "Volume", "value": f"{trip.quantity_cum} cum"},
                        {"label": "Grade", "value": trip.po.grade.code if trip.po and trip.po.grade else "M25"},
                        {"label": "Challan", "value": trip.challan.challan_number if trip.challan else "—"}
                    ],
                    "actionLabel": "Sign-off Delivery →",
                    "actionTo": "/supervisor",
                    "waitingTime": "In transit",
                    "status": "pending"
                })

        # 7. ACCOUNT: Outstanding Invoices & Payment Collections
        if role in ["account", "owner"]:
            invoices = Invoice.query.filter(Invoice.status.in_(["ISSUED", "PARTIALLY_PAID"])).all()
            due_invoices = [inv for inv in invoices if inv.outstanding_amount > 0.01]
            for inv in due_invoices:
                items.append({
                    "id": f"acc-inv-{inv.id}",
                    "role": "account",
                    "title": f"Collect Payment: {inv.invoice_number} (₹{inv.outstanding_amount:,.2f})",
                    "subtitle": f"Customer: {inv.customer.name if inv.customer else 'Customer'} · PO: {inv.po.po_number if inv.po else 'PO'} · Due: {inv.due_date.strftime('%d-%b-%Y')}",
                    "category": "Receivables & Billing",
                    "urgency": "urgent" if inv.due_date < now.date() else "attention",
                    "urgencyLabel": "Overdue" if inv.due_date < now.date() else "Payment Due",
                    "badgeText": f"₹{inv.outstanding_amount:,.0f} Due",
                    "badgeVariant": "destructive" if inv.due_date < now.date() else "warning",
                    "metrics": [
                        {"label": "Total Bill", "value": f"₹{inv.total:,.0f}"},
                        {"label": "Paid", "value": f"₹{inv.paid_amount:,.0f}"},
                        {"label": "Balance", "value": f"₹{inv.outstanding_amount:,.0f}"}
                    ],
                    "actionLabel": "Record Receipt →",
                    "actionTo": "/account",
                    "waitingTime": "Pending collection",
                    "status": "pending"
                })

        # 8. STORE: Materials needing Reorder
        if role in ["store", "production", "owner"]:
            materials = Material.query.all()
            for mat in materials:
                if mat.current_stock <= mat.reorder_level:
                    items.append({
                        "id": f"store-low-{mat.id}",
                        "role": "store",
                        "title": f"Low Stock Alert: {mat.name}",
                        "subtitle": f"Current stock is {mat.current_stock:,.0f} {mat.unit} (Reorder threshold: {mat.reorder_level:,.0f} {mat.unit}). Inward PO required.",
                        "category": "Material Inventory",
                        "urgency": "urgent",
                        "urgencyLabel": "Reorder Level Breached",
                        "badgeText": "Low Stock",
                        "badgeVariant": "destructive",
                        "metrics": [
                            {"label": "Current Stock", "value": f"{mat.current_stock:,.0f} {mat.unit}"},
                            {"label": "Reorder Level", "value": f"{mat.reorder_level:,.0f} {mat.unit}"}
                        ],
                        "actionLabel": "Inward Material →",
                        "actionTo": "/store",
                        "waitingTime": "Low level",
                        "status": "pending"
                    })

        return items
