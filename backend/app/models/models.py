import json
from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from backend.app.extensions import db
from backend.app.models.base import TimestampMixin, generate_uuid

# --- SEQUENCE COUNTER FOR CONCURRENCY SAFE AUTO-NUMBERING ---
class Sequence(db.Model):
    __tablename__ = "sequences"
    name = db.Column(db.String(50), primary_key=True)
    year = db.Column(db.Integer, primary_key=True)
    last_value = db.Column(db.Integer, default=0, nullable=False)

# --- USER & AUTH ---
class User(TimestampMixin, db.Model):
    __tablename__ = "users"
    
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(20), nullable=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(30), nullable=False, index=True)  # owner, customer, sales, dispatcher, production, qa
    is_manager = db.Column(db.Boolean, default=False, nullable=False)
    customer_id = db.Column(db.String(36), db.ForeignKey("customers.id"), nullable=True, index=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    customer = db.relationship("Customer", backref="users", lazy=True)

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "role": "sales_manager" if (self.role == "sales" and self.is_manager) else self.role,
            "is_manager": self.is_manager,
            "customer_id": self.customer_id,
            "customer_name": self.customer.name if self.customer else None,
            "is_active": self.is_active,
            "plant": "Apex Ready-Mix Plant"
        }

# --- PLANT ---
class Plant(TimestampMixin, db.Model):
    __tablename__ = "plant"
    
    name = db.Column(db.String(150), nullable=False)
    address = db.Column(db.Text, nullable=False)
    gstin = db.Column(db.String(30), nullable=False)
    phone = db.Column(db.String(30), nullable=True)
    email = db.Column(db.String(100), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "address": self.address,
            "gstin": self.gstin,
            "phone": self.phone,
            "email": self.email
        }

# --- CUSTOMER & SITE ---
class Customer(TimestampMixin, db.Model):
    __tablename__ = "customers"
    
    name = db.Column(db.String(150), nullable=False, index=True)
    contact_person = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(30), nullable=False)
    email = db.Column(db.String(100), nullable=False)
    gstin = db.Column(db.String(30), nullable=False)
    address = db.Column(db.Text, nullable=False)
    credit_days = db.Column(db.Integer, default=30, nullable=False)
    credit_limit = db.Column(db.Float, default=0.0, nullable=False)

    sites = db.relationship("Site", backref="customer", cascade="all, delete-orphan", lazy=True)
    orders = db.relationship("PurchaseOrder", backref="customer", lazy=True)

    def to_dict(self, include_sites=True):
        res = {
            "id": self.id,
            "name": self.name,
            "contactPerson": self.contact_person,
            "phone": self.phone,
            "email": self.email,
            "gstin": self.gstin,
            "billingAddress": self.address,
            "creditDays": self.credit_days,
            "creditLimit": self.credit_limit,
            "createdAt": self.created_at.isoformat()
        }
        if include_sites:
            res["sites"] = [site.to_dict() for site in self.sites]
        return res

class Site(TimestampMixin, db.Model):
    __tablename__ = "sites"
    
    customer_id = db.Column(db.String(36), db.ForeignKey("customers.id"), nullable=False, index=True)
    name = db.Column(db.String(150), nullable=False)
    address = db.Column(db.Text, nullable=False)
    contact_person = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(30), nullable=False)
    accessibility_notes = db.Column(db.Text, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "customerId": self.customer_id,
            "name": self.name,
            "address": self.address,
            "contactPerson": self.contact_person,
            "phone": self.phone,
            "accessibilityNotes": self.accessibility_notes or ""
        }

# --- GRADE & MIX DESIGN ---
class Grade(TimestampMixin, db.Model):
    __tablename__ = "grades"
    
    code = db.Column(db.String(20), unique=True, nullable=False, index=True)  # M15, M20, M25, etc.
    characteristic_strength_mpa = db.Column(db.Float, nullable=False)
    slump_min_mm = db.Column(db.Integer, nullable=False)
    slump_max_mm = db.Column(db.Integer, nullable=False)
    default_rate = db.Column(db.Float, nullable=False)

    mix_design = db.relationship("MixDesign", backref="grade", uselist=False, lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "code": self.code,
            "characteristicStrengthMpa": self.characteristic_strength_mpa,
            "slumpMinMm": self.slump_min_mm,
            "slumpMaxMm": self.slump_max_mm,
            "defaultRate": self.default_rate,
            "mixDesign": self.mix_design.to_dict() if self.mix_design else None
        }

class MixDesign(TimestampMixin, db.Model):
    __tablename__ = "mix_designs"
    
    grade_id = db.Column(db.String(36), db.ForeignKey("grades.id"), nullable=False, unique=True, index=True)
    cement_kg = db.Column(db.Float, nullable=False)
    sand_kg = db.Column(db.Float, nullable=False)
    aggregate_10mm_kg = db.Column(db.Float, nullable=False)
    aggregate_20mm_kg = db.Column(db.Float, nullable=False)
    water_l = db.Column(db.Float, nullable=False)
    admixture_l = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "gradeId": self.grade_id,
            "cementKg": self.cement_kg,
            "sandKg": self.sand_kg,
            "aggregate10mmKg": self.aggregate_10mm_kg,
            "aggregate20mmKg": self.aggregate_20mm_kg,
            "waterL": self.water_l,
            "admixtureL": self.admixture_l
        }

# --- MATERIALS & STOCK TRANSACTIONS ---
class Material(TimestampMixin, db.Model):
    __tablename__ = "materials"
    
    name = db.Column(db.String(100), unique=True, nullable=False)
    unit = db.Column(db.String(20), nullable=False)  # kg, l
    current_stock = db.Column(db.Float, default=0.0, nullable=False)
    reorder_level = db.Column(db.Float, default=0.0, nullable=False)

    transactions = db.relationship("StockTransaction", backref="material", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "unit": self.unit,
            "currentStock": round(self.current_stock, 2),
            "reorderLevel": round(self.reorder_level, 2),
            "isLowStock": self.current_stock <= self.reorder_level
        }

class StockTransaction(TimestampMixin, db.Model):
    __tablename__ = "stock_transactions"
    
    material_id = db.Column(db.String(36), db.ForeignKey("materials.id"), nullable=False, index=True)
    type = db.Column(db.String(20), nullable=False)  # IN, OUT, ADJUST
    quantity = db.Column(db.Float, nullable=False)
    reference = db.Column(db.String(100), nullable=True)
    note = db.Column(db.Text, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "materialId": self.material_id,
            "materialName": self.material.name if self.material else None,
            "type": self.type,
            "quantity": self.quantity,
            "reference": self.reference,
            "note": self.note,
            "createdAt": self.created_at.isoformat()
        }

# --- TRUCKS & DRIVERS ---
class Truck(TimestampMixin, db.Model):
    __tablename__ = "trucks"
    
    tm_number = db.Column(db.String(30), unique=True, nullable=False, index=True)
    capacity_cum = db.Column(db.Integer, nullable=False)  # 5, 7, 8, 9, 10
    status = db.Column(db.String(30), default="AVAILABLE", nullable=False, index=True)  # AVAILABLE, ASSIGNED, LOADED, IN_TRANSIT, MAINTENANCE
    default_driver_id = db.Column(db.String(36), db.ForeignKey("drivers.id"), nullable=True)

    default_driver = db.relationship("Driver", foreign_keys=[default_driver_id], lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "tmNumber": self.tm_number,
            "capacity": self.capacity_cum,
            "status": self.status,
            "defaultDriverId": self.default_driver_id,
            "defaultDriverName": self.default_driver.name if self.default_driver else None
        }

class Driver(TimestampMixin, db.Model):
    __tablename__ = "drivers"
    
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(30), nullable=False)
    license_no = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(30), default="AVAILABLE", nullable=False, index=True)  # AVAILABLE, ASSIGNED, UNAVAILABLE

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "phone": self.phone,
            "licenseNo": self.license_no,
            "status": self.status
        }

# --- PURCHASE ORDERS ---
class PurchaseOrder(TimestampMixin, db.Model):
    __tablename__ = "purchase_orders"
    
    po_number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    customer_id = db.Column(db.String(36), db.ForeignKey("customers.id"), nullable=False, index=True)
    site_id = db.Column(db.String(36), db.ForeignKey("sites.id"), nullable=False, index=True)
    grade_id = db.Column(db.String(36), db.ForeignKey("grades.id"), nullable=False, index=True)
    quantity_cum = db.Column(db.Float, nullable=False)
    rate_per_cum = db.Column(db.Float, nullable=False)
    delivery_datetime = db.Column(db.DateTime, nullable=False, index=True)
    purpose = db.Column(db.String(50), nullable=False)  # Slab, Column, Beam, Footing, Other
    
    # Pump specifications
    pump_required = db.Column(db.Boolean, default=False, nullable=False)
    pump_ownership = db.Column(db.String(50), nullable=True)  # Customer Pump, Company Pump
    pump_type = db.Column(db.String(50), nullable=True)       # Horizontal, Vertical
    pipeline_length = db.Column(db.Integer, nullable=True)
    workers_required = db.Column(db.Integer, nullable=True)
    
    payment_terms_days = db.Column(db.Integer, default=30, nullable=False)
    ubitech_ref = db.Column(db.String(100), nullable=True)
    status = db.Column(db.String(30), default="DRAFT", nullable=False, index=True)
    
    approved_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    approval_remarks = db.Column(db.Text, nullable=True)
    cancel_reason = db.Column(db.Text, nullable=True)
    rejection_reason = db.Column(db.Text, nullable=True)
    submitted_at = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)

    site = db.relationship("Site", lazy=True)
    grade = db.relationship("Grade", lazy=True)
    trips = db.relationship("Trip", backref="po", lazy=True)
    approver = db.relationship("User", foreign_keys=[approved_by], lazy=True)

    @property
    def delivered_quantity(self) -> float:
        return sum(
            t.delivered_quantity or t.quantity_cum 
            for t in self.trips 
            if t.status == "DELIVERED"
        )

    @property
    def balance_quantity(self) -> float:
        active_trips_qty = sum(
            t.quantity_cum 
            for t in self.trips 
            if t.status not in ["CANCELLED", "REPLACED"]
        )
        return max(0.0, round(self.quantity_cum - active_trips_qty, 2))

    def to_dict(self):
        return {
            "id": self.id,
            "poNumber": self.po_number,
            "customerId": self.customer_id,
            "customerName": self.customer.name if self.customer else None,
            "siteId": self.site_id,
            "siteName": self.site.name if self.site else None,
            "siteAddress": self.site.address if self.site else None,
            "gradeId": self.grade_id,
            "grade": self.grade.code if self.grade else None,
            "quantity": self.quantity_cum,
            "deliveredQuantity": round(self.delivered_quantity, 2),
            "balanceQuantity": round(self.balance_quantity, 2),
            "ratePerCum": self.rate_per_cum,
            "deliveryDate": self.delivery_datetime.strftime("%Y-%m-%d"),
            "deliveryTime": self.delivery_datetime.strftime("%H:%M"),
            "deliveryDateTime": self.delivery_datetime.isoformat(),
            "purpose": self.purpose,
            "pumpRequired": self.pump_required,
            "pumpOwnership": self.pump_ownership,
            "pumpType": self.pump_type,
            "pipelineLength": self.pipeline_length,
            "workersRequired": self.workers_required,
            "paymentTerms": f"{self.payment_terms_days} Days",
            "paymentTermsDays": self.payment_terms_days,
            "reference": self.ubitech_ref or "",
            "notes": self.notes or "",
            "status": self.status,
            "createdBy": self.created_by,
            "createdAt": self.created_at.isoformat(),
            "submittedAt": self.submitted_at.isoformat() if self.submitted_at else None,
            "approvedAt": self.approved_at.isoformat() if self.approved_at else None,
            "approvedBy": self.approver.name if self.approver else None,
            "approvalRemarks": self.approval_remarks,
            "cancelReason": self.cancel_reason,
            "rejectionReason": self.rejection_reason
        }

# --- TRIPS ---
class Trip(TimestampMixin, db.Model):
    __tablename__ = "trips"
    
    trip_number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    po_id = db.Column(db.String(36), db.ForeignKey("purchase_orders.id"), nullable=False, index=True)
    truck_id = db.Column(db.String(36), db.ForeignKey("trucks.id"), nullable=True, index=True)
    driver_id = db.Column(db.String(36), db.ForeignKey("drivers.id"), nullable=True, index=True)
    sequence = db.Column(db.Integer, default=1, nullable=False)
    quantity_cum = db.Column(db.Float, nullable=False)
    planned_datetime = db.Column(db.DateTime, nullable=False, index=True)
    status = db.Column(db.String(30), default="PLANNED", nullable=False, index=True)
    
    dispatched_at = db.Column(db.DateTime, nullable=True)
    delivered_at = db.Column(db.DateTime, nullable=True)
    delivered_quantity = db.Column(db.Float, nullable=True)
    receiver_name = db.Column(db.String(100), nullable=True)
    replaced_trip_id = db.Column(db.String(36), db.ForeignKey("trips.id"), nullable=True)
    notes = db.Column(db.Text, nullable=True)

    truck = db.relationship("Truck", lazy=True)
    driver = db.relationship("Driver", lazy=True)
    batch_sheet = db.relationship("BatchSheet", backref="trip", uselist=False, lazy=True)
    challan = db.relationship("Challan", backref="trip", uselist=False, lazy=True)
    qc_check = db.relationship("QcCheck", backref="trip", uselist=False, lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "tripNumber": self.trip_number,
            "poId": self.po_id,
            "poNumber": self.po.po_number if self.po else None,
            "customerName": self.po.customer.name if (self.po and self.po.customer) else None,
            "siteName": self.po.site.name if (self.po and self.po.site) else None,
            "siteAddress": self.po.site.address if (self.po and self.po.site) else None,
            "grade": self.po.grade.code if (self.po and self.po.grade) else None,
            "gradeId": self.po.grade_id if self.po else None,
            "sequence": self.sequence,
            "quantity": self.quantity_cum,
            "tmId": self.truck_id,
            "tmNumber": self.truck.tm_number if self.truck else None,
            "tmCapacity": self.truck.capacity_cum if self.truck else None,
            "driverId": self.driver_id,
            "driverName": self.driver.name if self.driver else None,
            "driverPhone": self.driver.phone if self.driver else None,
            "plannedTime": self.planned_datetime.isoformat(),
            "status": self.status,
            "batchSheetId": self.batch_sheet.id if self.batch_sheet else None,
            "challanNumber": self.challan.challan_number if self.challan else None,
            "challanId": self.challan.id if self.challan else None,
            "dispatchTime": self.dispatched_at.isoformat() if self.dispatched_at else None,
            "deliveredAt": self.delivered_at.isoformat() if self.delivered_at else None,
            "deliveredQuantity": self.delivered_quantity,
            "receiverName": self.receiver_name,
            "replacedTripId": self.replaced_trip_id,
            "notes": self.notes or "",
            "lastUpdate": self.updated_at.isoformat()
        }

# --- BATCH SHEETS & REVISIONS ---
class BatchSheet(TimestampMixin, db.Model):
    __tablename__ = "batch_sheets"
    
    batch_number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    trip_id = db.Column(db.String(36), db.ForeignKey("trips.id"), nullable=False, unique=True, index=True)
    grade_id = db.Column(db.String(36), db.ForeignKey("grades.id"), nullable=False, index=True)
    quantity_cum = db.Column(db.Float, nullable=False)
    
    # Material weights batched (actual vs theoretical)
    cement_kg = db.Column(db.Float, nullable=False)
    sand_kg = db.Column(db.Float, nullable=False)
    agg_10_kg = db.Column(db.Float, nullable=False)
    agg_20_kg = db.Column(db.Float, nullable=False)
    water_l = db.Column(db.Float, nullable=False)
    admixture_l = db.Column(db.Float, nullable=False)
    
    batched_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    qc_status = db.Column(db.String(30), default="PENDING", nullable=False)  # PENDING, APPROVED, REJECTED
    qc_signed_by = db.Column(db.String(100), nullable=True)
    qc_signed_at = db.Column(db.DateTime, nullable=True)

    grade = db.relationship("Grade", lazy=True)
    revisions = db.relationship("BatchSheetRevision", backref="batch_sheet", lazy=True, order_by="BatchSheetRevision.revision_number")

    def to_dict(self):
        mix = self.grade.mix_design if self.grade else None
        theo_cement = round(mix.cement_kg * self.quantity_cum, 1) if mix else 0
        theo_sand = round(mix.sand_kg * self.quantity_cum, 1) if mix else 0
        theo_agg10 = round(mix.aggregate_10mm_kg * self.quantity_cum, 1) if mix else 0
        theo_agg20 = round(mix.aggregate_20mm_kg * self.quantity_cum, 1) if mix else 0
        theo_water = round(mix.water_l * self.quantity_cum, 1) if mix else 0
        theo_admix = round(mix.admixture_l * self.quantity_cum, 2) if mix else 0

        return {
            "id": self.id,
            "batchNumber": self.batch_number,
            "tripId": self.trip_id,
            "grade": self.grade.code if self.grade else None,
            "quantity": self.quantity_cum,
            "batchTime": self.batched_at.isoformat(),
            "operator": self.created_by or "Auto AJAX Batcher",
            "qcStatus": self.qc_status,
            "qcSignedBy": self.qc_signed_by,
            "qcSignedAt": self.qc_signed_at.isoformat() if self.qc_signed_at else None,
            "materials": [
                {"material": "Cement (OPC 53)", "theoretical": theo_cement, "actual": round(self.cement_kg, 1), "unit": "kg"},
                {"material": "River Sand (Zone II)", "theoretical": theo_sand, "actual": round(self.sand_kg, 1), "unit": "kg"},
                {"material": "Aggregate 10mm", "theoretical": theo_agg10, "actual": round(self.agg_10_kg, 1), "unit": "kg"},
                {"material": "Aggregate 20mm", "theoretical": theo_agg20, "actual": round(self.agg_20_kg, 1), "unit": "kg"},
                {"material": "Water", "theoretical": theo_water, "actual": round(self.water_l, 1), "unit": "l"},
                {"material": "Admixture (PCE)", "theoretical": theo_admix, "actual": round(self.admixture_l, 2), "unit": "l"}
            ],
            "revisions": [r.to_dict() for r in self.revisions],
            "trip": self.trip.to_dict() if self.trip else None
        }

class BatchSheetRevision(TimestampMixin, db.Model):
    __tablename__ = "batch_sheet_revisions"
    
    batch_sheet_id = db.Column(db.String(36), db.ForeignKey("batch_sheets.id"), nullable=False, index=True)
    revision_number = db.Column(db.Integer, nullable=False)
    cement_kg = db.Column(db.Float, nullable=False)
    sand_kg = db.Column(db.Float, nullable=False)
    agg_10_kg = db.Column(db.Float, nullable=False)
    agg_20_kg = db.Column(db.Float, nullable=False)
    water_l = db.Column(db.Float, nullable=False)
    admixture_l = db.Column(db.Float, nullable=False)
    reason = db.Column(db.Text, nullable=False)
    revised_by = db.Column(db.String(100), nullable=False)
    revised_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "revisionNumber": self.revision_number,
            "cementKg": self.cement_kg,
            "sandKg": self.sand_kg,
            "agg10Kg": self.agg_10_kg,
            "agg20Kg": self.agg_20_kg,
            "waterL": self.water_l,
            "admixtureL": self.admixture_l,
            "reason": self.reason,
            "revisedBy": self.revised_by,
            "revisedAt": self.revised_at.isoformat()
        }

# --- QC CHECKS ---
class QcCheck(TimestampMixin, db.Model):
    __tablename__ = "qc_checks"
    
    trip_id = db.Column(db.String(36), db.ForeignKey("trips.id"), nullable=False, unique=True, index=True)
    batch_sheet_id = db.Column(db.String(36), db.ForeignKey("batch_sheets.id"), nullable=False, index=True)
    physical_inspection_ok = db.Column(db.Boolean, default=True, nullable=False)
    slump_mm = db.Column(db.Integer, nullable=False)
    bleeding_ok = db.Column(db.Boolean, default=True, nullable=False)
    wrong_mix_ok = db.Column(db.Boolean, default=True, nullable=False)
    admixture_type = db.Column(db.String(100), nullable=True)
    admixture_qty = db.Column(db.Float, nullable=True)
    decision = db.Column(db.String(20), nullable=False)  # APPROVE, REJECT
    reject_action = db.Column(db.String(20), nullable=True)  # CORRECT, REPLACE
    remarks = db.Column(db.Text, nullable=True)
    checked_by = db.Column(db.String(100), nullable=False)
    checked_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    batch_sheet = db.relationship("BatchSheet", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "tripId": self.trip_id,
            "batchSheetId": self.batch_sheet_id,
            "physicalInspection": "PASS" if self.physical_inspection_ok else "FAIL",
            "slump": self.slump_mm,
            "bleeding": "PASS" if self.bleeding_ok else "FAIL",
            "wrongMix": "PASS" if self.wrong_mix_ok else "FAIL",
            "admixtureAdded": f"{self.admixture_qty}L ({self.admixture_type})" if self.admixture_qty else "None",
            "decision": self.decision,
            "rejectAction": self.reject_action,
            "remarks": self.remarks or "",
            "qcSign": self.checked_by,
            "checkedAt": self.checked_at.isoformat()
        }

# --- CUBES & TESTS ---
class CubeSet(TimestampMixin, db.Model):
    __tablename__ = "cube_sets"
    
    batch_sheet_id = db.Column(db.String(36), db.ForeignKey("batch_sheets.id"), nullable=False, index=True)
    trip_id = db.Column(db.String(36), db.ForeignKey("trips.id"), nullable=False, index=True)
    cast_date = db.Column(db.Date, nullable=False, index=True)
    cube_count = db.Column(db.Integer, default=6, nullable=False)

    trip = db.relationship("Trip", lazy=True)
    batch_sheet = db.relationship("BatchSheet", lazy=True)
    tests = db.relationship("CubeTest", backref="cube_set", cascade="all, delete-orphan", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "batchSheetId": self.batch_sheet_id,
            "tripId": self.trip_id,
            "tripNumber": self.trip.trip_number if self.trip else None,
            "grade": self.trip.po.grade.code if (self.trip and self.trip.po and self.trip.po.grade) else None,
            "castDate": self.cast_date.isoformat(),
            "cubeCount": self.cube_count,
            "tests": [t.to_dict() for t in self.tests]
        }

class CubeTest(TimestampMixin, db.Model):
    __tablename__ = "cube_tests"
    
    cube_set_id = db.Column(db.String(36), db.ForeignKey("cube_sets.id"), nullable=False, index=True)
    age_days = db.Column(db.Integer, nullable=False)  # 3, 7, 28
    due_date = db.Column(db.Date, nullable=False, index=True)
    tested_on = db.Column(db.Date, nullable=True)
    strength_mpa = db.Column(db.Float, nullable=True)
    result = db.Column(db.String(20), default="PENDING", nullable=False)  # PASS, FAIL, PENDING
    tested_by = db.Column(db.String(100), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "cubeSetId": self.cube_set_id,
            "ageDays": self.age_days,
            "dueDate": self.due_date.isoformat(),
            "testedOn": self.tested_on.isoformat() if self.tested_on else None,
            "strengthMpa": self.strength_mpa,
            "result": self.result,
            "testedBy": self.tested_by
        }

class MaterialTest(TimestampMixin, db.Model):
    __tablename__ = "material_tests"
    
    material = db.Column(db.String(100), nullable=False)
    test_name = db.Column(db.String(150), nullable=False)
    result = db.Column(db.String(100), nullable=False)
    tested_on = db.Column(db.Date, nullable=False)
    remarks = db.Column(db.Text, nullable=True)
    tested_by = db.Column(db.String(100), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "material": self.material,
            "testName": self.test_name,
            "result": self.result,
            "testedOn": self.tested_on.isoformat(),
            "remarks": self.remarks or "",
            "testedBy": self.tested_by
        }

# --- CHALLANS ---
class Challan(TimestampMixin, db.Model):
    __tablename__ = "challans"
    
    challan_number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    trip_id = db.Column(db.String(36), db.ForeignKey("trips.id"), nullable=False, unique=True, index=True)
    issued_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    printed_copies = db.Column(db.Integer, default=3, nullable=False)
    released_by = db.Column(db.String(100), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "challanNumber": self.challan_number,
            "tripId": self.trip_id,
            "issuedAt": self.issued_at.isoformat(),
            "printedCopies": self.printed_copies,
            "releasedBy": self.released_by
        }

# --- INVOICES & PAYMENTS ---
class Invoice(TimestampMixin, db.Model):
    __tablename__ = "invoices"
    
    invoice_number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    po_id = db.Column(db.String(36), db.ForeignKey("purchase_orders.id"), nullable=False, index=True)
    customer_id = db.Column(db.String(36), db.ForeignKey("customers.id"), nullable=False, index=True)
    issue_date = db.Column(db.Date, nullable=False, index=True)
    due_date = db.Column(db.Date, nullable=False, index=True)
    subtotal = db.Column(db.Float, nullable=False)
    gst_percent = db.Column(db.Float, default=18.0, nullable=False)
    total = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(30), default="DRAFT", nullable=False, index=True)  # DRAFT, ISSUED, PARTIALLY_PAID, PAID, CANCELLED

    po = db.relationship("PurchaseOrder", lazy=True)
    customer = db.relationship("Customer", lazy=True)
    lines = db.relationship("InvoiceLine", backref="invoice", cascade="all, delete-orphan", lazy=True)
    payments = db.relationship("Payment", backref="invoice", cascade="all, delete-orphan", lazy=True)

    @property
    def paid_amount(self) -> float:
        return sum(p.amount for p in self.payments)

    @property
    def outstanding_amount(self) -> float:
        return max(0.0, round(self.total - self.paid_amount, 2))

    @property
    def is_overdue(self) -> bool:
        if self.status in ["PAID", "CANCELLED"]:
            return False
        return datetime.now(timezone.utc).date() > self.due_date

    def to_dict(self):
        status = self.status
        if status in ["ISSUED", "PARTIALLY_PAID"] and self.is_overdue:
            status = "OVERDUE"

        return {
            "id": self.id,
            "invoiceNumber": self.invoice_number,
            "poId": self.po_id,
            "poNumber": self.po.po_number if self.po else None,
            "customerId": self.customer_id,
            "customerName": self.customer.name if self.customer else None,
            "issueDate": self.issue_date.isoformat(),
            "dueDate": self.due_date.isoformat(),
            "subtotal": self.subtotal,
            "gstPercent": self.gst_percent,
            "total": self.total,
            "paidAmount": round(self.paid_amount, 2),
            "outstandingAmount": round(self.outstanding_amount, 2),
            "status": status,
            "isOverdue": self.is_overdue,
            "lines": [l.to_dict() for l in self.lines],
            "payments": [p.to_dict() for p in self.payments]
        }

class InvoiceLine(TimestampMixin, db.Model):
    __tablename__ = "invoice_lines"
    
    invoice_id = db.Column(db.String(36), db.ForeignKey("invoices.id"), nullable=False, index=True)
    trip_id = db.Column(db.String(36), db.ForeignKey("trips.id"), nullable=False)
    quantity = db.Column(db.Float, nullable=False)
    rate = db.Column(db.Float, nullable=False)
    amount = db.Column(db.Float, nullable=False)

    trip = db.relationship("Trip", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "invoiceId": self.invoice_id,
            "tripId": self.trip_id,
            "tripNumber": self.trip.trip_number if self.trip else None,
            "quantity": self.quantity,
            "rate": self.rate,
            "amount": self.amount
        }

class Payment(TimestampMixin, db.Model):
    __tablename__ = "payments"
    
    invoice_id = db.Column(db.String(36), db.ForeignKey("invoices.id"), nullable=False, index=True)
    amount = db.Column(db.Float, nullable=False)
    paid_on = db.Column(db.Date, nullable=False)
    mode = db.Column(db.String(30), nullable=False)  # NEFT, RTGS, CHEQUE, CASH, UPI
    reference = db.Column(db.String(100), nullable=False)
    recorded_by = db.Column(db.String(100), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "invoiceId": self.invoice_id,
            "amount": self.amount,
            "paidOn": self.paid_on.isoformat(),
            "mode": self.mode,
            "reference": self.reference,
            "recordedBy": self.recorded_by
        }

# --- NOTIFICATION LOG (MOCK WHATSAPP) ---
class NotificationLog(TimestampMixin, db.Model):
    __tablename__ = "notification_log"
    
    channel = db.Column(db.String(30), default="whatsapp_simulated", nullable=False)
    recipient = db.Column(db.String(100), nullable=False)
    template = db.Column(db.String(100), nullable=False)
    payload = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), default="SENT", nullable=False)
    sent_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    related_trip_id = db.Column(db.String(36), db.ForeignKey("trips.id"), nullable=True, index=True)
    related_po_id = db.Column(db.String(36), db.ForeignKey("purchase_orders.id"), nullable=True, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "channel": self.channel,
            "recipient": self.recipient,
            "template": self.template,
            "payload": self.payload,
            "status": self.status,
            "sentAt": self.sent_at.isoformat(),
            "relatedTripId": self.related_trip_id,
            "relatedPoId": self.related_po_id
        }

# --- AUDIT LOG ---
class AuditLog(db.Model):
    __tablename__ = "audit_log"
    
    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True, index=True)
    action = db.Column(db.String(50), nullable=False)  # CREATE, UPDATE, DELETE, STATE_CHANGE
    entity = db.Column(db.String(50), nullable=False)  # PurchaseOrder, Trip, Invoice, etc.
    entity_id = db.Column(db.String(36), nullable=False, index=True)
    before_data = db.Column(db.Text, nullable=True)
    after_data = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    user = db.relationship("User", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "userName": self.user.name if self.user else "System",
            "action": self.action,
            "entity": self.entity,
            "entityId": self.entity_id,
            "before": json.loads(self.before_data) if self.before_data else None,
            "after": json.loads(self.after_data) if self.after_data else None,
            "createdAt": self.created_at.isoformat()
        }

# --- STORE & WEIGHBRIDGE ---
class WeighbridgeTicket(TimestampMixin, db.Model):
    __tablename__ = "weighbridge_tickets"

    ticket_number = db.Column(db.String(50), unique=True, nullable=False, index=True)
    type = db.Column(db.String(20), nullable=False)  # INWARD, OUTWARD
    vehicle_number = db.Column(db.String(30), nullable=False, index=True)
    material = db.Column(db.String(100), nullable=False)
    supplier_or_customer = db.Column(db.String(150), nullable=False)
    gross_weight = db.Column(db.Float, default=0.0, nullable=False)
    tare_weight = db.Column(db.Float, default=0.0, nullable=False)
    net_weight = db.Column(db.Float, default=0.0, nullable=False)
    gross_time = db.Column(db.String(30), nullable=False)
    tare_time = db.Column(db.String(30), nullable=False)
    status = db.Column(db.String(30), default="COMPLETED", nullable=False)  # PENDING_TARE, COMPLETED
    variance = db.Column(db.Float, default=0.0, nullable=True)
    challan_weight = db.Column(db.Float, default=0.0, nullable=True)
    received_rs = db.Column(db.Float, default=0.0, nullable=True)
    wb_name = db.Column(db.String(50), default="Weighbridge #1", nullable=True)
    driver_name = db.Column(db.String(100), nullable=True)
    watchman_name = db.Column(db.String(100), nullable=True)
    gate_pass_no = db.Column(db.String(50), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "ticketNumber": self.ticket_number,
            "type": self.type,
            "vehicleNumber": self.vehicle_number,
            "material": self.material,
            "supplierOrCustomer": self.supplier_or_customer,
            "grossWeight": self.gross_weight,
            "tareWeight": self.tare_weight,
            "netWeight": self.net_weight,
            "grossTime": self.gross_time,
            "tareTime": self.tare_time,
            "status": self.status,
            "variance": self.variance or 0,
            "challanWeight": self.challan_weight or 0,
            "receivedRs": self.received_rs or 0,
            "wbName": self.wb_name or "Weighbridge #1",
            "driverName": self.driver_name or "",
            "watchmanName": self.watchman_name or "",
            "gatePassNo": self.gate_pass_no or "",
            "createdAt": self.created_at.isoformat()
        }

class TransitMixerPayload(TimestampMixin, db.Model):
    __tablename__ = "transit_mixer_payloads"

    s_no = db.Column(db.Integer, nullable=False)
    vehicle_no = db.Column(db.String(30), unique=True, nullable=False, index=True)
    vehicle_type = db.Column(db.String(50), nullable=False)
    make = db.Column(db.String(50), nullable=False)  # Ashok Leyland, Benz, TATA
    location = db.Column(db.String(50), nullable=False)  # Mulkhed, Mhalunge
    vehicle_tyre_details = db.Column(db.String(30), nullable=False)  # 10 Tyres, 12 Tyres
    overload_pass = db.Column(db.String(10), default="Yes", nullable=False)  # Yes, No
    installed_handi_capacity_cum = db.Column(db.Float, nullable=False)
    rto_gvw_kg = db.Column(db.Float, nullable=False)
    tare_weight_kg = db.Column(db.Float, nullable=False)
    weight_of_water_kg = db.Column(db.Float, nullable=False)
    new_tare_weight_kg = db.Column(db.Float, nullable=False)
    actual_weight_for_loading_kg = db.Column(db.Float, nullable=False)
    payload_capacity_rc_gvw_cum = db.Column(db.Float, nullable=False)
    supply_payload_capacity_overload_pass_cum = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "sNo": self.s_no,
            "vehicleNo": self.vehicle_no,
            "vehicleType": self.vehicle_type,
            "make": self.make,
            "location": self.location,
            "vehicleTyreDetails": self.vehicle_tyre_details,
            "overLoadPass": self.overload_pass,
            "installedHandiCapacityCum": self.installed_handi_capacity_cum,
            "rtoGvwKg": self.rto_gvw_kg,
            "tareWeightKg": self.tare_weight_kg,
            "weightOfWaterKg": self.weight_of_water_kg,
            "newTareWeightKg": self.new_tare_weight_kg,
            "actualWeightForLoadingKg": self.actual_weight_for_loading_kg,
            "payLoadCapacityRcGvwCum": self.payload_capacity_rc_gvw_cum,
            "supplyPayLoadCapacityOverloadPassCum": self.supply_payload_capacity_overload_pass_cum
        }

class DprRecord(TimestampMixin, db.Model):
    __tablename__ = "dpr_records"

    date = db.Column(db.String(20), unique=True, nullable=False, index=True)
    total_batches = db.Column(db.Integer, default=0, nullable=False)
    total_cum = db.Column(db.Float, default=0.0, nullable=False)
    cement_consumed_mt = db.Column(db.Float, default=0.0, nullable=False)
    fly_ash_consumed_mt = db.Column(db.Float, default=0.0, nullable=False)
    ggbs_consumed_mt = db.Column(db.Float, default=0.0, nullable=False)
    sand_consumed_mt = db.Column(db.Float, default=0.0, nullable=False)
    aggregate_consumed_mt = db.Column(db.Float, default=0.0, nullable=False)
    water_consumed_kl = db.Column(db.Float, default=0.0, nullable=False)
    admixture_consumed_kg = db.Column(db.Float, default=0.0, nullable=False)
    diesel_consumed_ltr = db.Column(db.Float, default=0.0, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "date": self.date,
            "totalBatches": self.total_batches,
            "totalCum": self.total_cum,
            "cementConsumedMt": self.cement_consumed_mt,
            "flyAshConsumedMt": self.fly_ash_consumed_mt,
            "ggbsConsumedMt": self.ggbs_consumed_mt,
            "sandConsumedMt": self.sand_consumed_mt,
            "aggregateConsumedMt": self.aggregate_consumed_mt,
            "waterConsumedKl": self.water_consumed_kl,
            "admixtureConsumedKg": self.admixture_consumed_kg,
            "dieselConsumedLtr": self.diesel_consumed_ltr
        }

class ExpenseRecord(TimestampMixin, db.Model):
    __tablename__ = "expense_records"

    category = db.Column(db.String(50), nullable=False)
    vendor = db.Column(db.String(150), nullable=False)
    bill_no = db.Column(db.String(50), nullable=False)
    date = db.Column(db.String(20), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), default="PAID", nullable=False)
    description = db.Column(db.Text, default="", nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "category": self.category,
            "vendor": self.vendor,
            "billNo": self.bill_no,
            "date": self.date,
            "amount": self.amount,
            "status": self.status,
            "description": self.description
        }

class AttendanceRecord(TimestampMixin, db.Model):
    __tablename__ = "attendance_records"

    type = db.Column(db.String(20), nullable=False)  # DRIVER, STAFF
    name = db.Column(db.String(100), nullable=False)
    designation_or_vehicle = db.Column(db.String(100), nullable=False)
    shift = db.Column(db.String(20), default="Day", nullable=False)
    trips_or_tasks = db.Column(db.Integer, default=0, nullable=False)
    status = db.Column(db.String(20), default="PRESENT", nullable=False)  # PRESENT, ABSENT, ON_TRIP
    sync_source = db.Column(db.String(30), default="UBITECH", nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "name": self.name,
            "designationOrVehicle": self.designation_or_vehicle,
            "shift": self.shift,
            "tripsOrTasks": self.trips_or_tasks,
            "status": self.status,
            "syncSource": self.sync_source
        }

class WeighbridgeSettings(TimestampMixin, db.Model):
    __tablename__ = "weighbridge_settings"

    plant_name = db.Column(db.String(150), default="Sai ReadyMix Concrete - Hinjewadi", nullable=False)
    vendor_software_name = db.Column(db.String(100), default="Sai Weigh Pro v4.2", nullable=False)
    vendor_company_name = db.Column(db.String(150), default="Sai Scales & Automation Pvt Ltd", nullable=False)
    customer_care = db.Column(db.String(50), default="+91 20 6789 0100", nullable=False)
    wb_name = db.Column(db.String(50), default="WB-01 (Inward/Outward Pitless 60T)", nullable=False)
    com_port = db.Column(db.String(20), default="COM3 / 9600-8-N-1", nullable=False)
    auto_capture = db.Column(db.Boolean, default=True, nullable=False)

    def to_dict(self):
        return {
            "plantName": self.plant_name,
            "vendorSoftwareName": self.vendor_software_name,
            "vendorCompanyName": self.vendor_company_name,
            "customerCare": self.customer_care,
            "wbName": self.wb_name,
            "comPort": self.com_port,
            "autoCapture": self.auto_capture
        }

# --- HR & PAYROLL ---
class Employee(TimestampMixin, db.Model):
    __tablename__ = "employees"

    emp_code = db.Column(db.String(30), unique=True, nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    department = db.Column(db.String(50), nullable=False)
    role = db.Column(db.String(50), nullable=False)
    join_date = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(20), default="ACTIVE", nullable=False)
    base_salary = db.Column(db.Float, default=0.0, nullable=False)

    def to_dict(self):
        return {
            "id": self.emp_code,
            "name": self.name,
            "department": self.department,
            "role": self.role,
            "joinDate": self.join_date,
            "status": self.status,
            "baseSalary": self.base_salary
        }

class PayrollRun(TimestampMixin, db.Model):
    __tablename__ = "payroll_runs"

    payroll_code = db.Column(db.String(30), unique=True, nullable=False, index=True)
    period = db.Column(db.String(30), nullable=False)
    total_employees = db.Column(db.Integer, nullable=False)
    total_amount = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), default="PAID", nullable=False)
    processed_date = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            "id": self.payroll_code,
            "period": self.period,
            "totalEmployees": self.total_employees,
            "totalAmount": self.total_amount,
            "status": self.status,
            "processedDate": self.processed_date.isoformat() if self.processed_date else None
        }

