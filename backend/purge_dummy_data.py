"""
Purge all dummy and seed data from the RMC database for a clean start.
Preserves:
- All 10 User login accounts (with password Demo@123 so every portal is immediately accessible)
- Plant settings and master profile
- Concrete Grades (M15–M40) and standard IS 10262 mix designs
- Standard Material catalogue (current stock reset to 0.0 so inventory is inwarded from scratch)
- Trucks & Drivers (status reset to AVAILABLE)
- Numbering sequences reset to start fresh at PO-2026-0001, TRIP-2026-0001, etc.
Removes:
- All Customers & Sites (users create fresh accounts via Sales Desk "Add New Customer")
- All Purchase Orders & Trips
- All Batch Sheets, Revisions & QC Tests
- All Challans, Invoices & Payments
- All Weighbridge Tickets, Stock Transactions, DPRs, TM Logs & Expense records
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from datetime import datetime, timezone
from backend.app import create_app
from backend.app.extensions import db
from backend.app.models.models import (
    Customer, Site, PurchaseOrder, Trip, BatchSheet, BatchSheetRevision,
    Challan, QcCheck, CubeSet, CubeTest, Invoice, InvoiceLine, Payment,
    WeighbridgeTicket, StockTransaction, Material, Truck, Driver,
    DprRecord, ExpenseRecord, AttendanceRecord, PayrollRun, MaterialTest,
    AuditLog, NotificationLog, Sequence, User, TransitMixerPayload, TmTripLog,
    Grade, MixDesign, Plant, WeighbridgeSettings
)

def execute_purge():
    print("Clearing all transactional and demo records...")

    # 1. Billing & Payments
    Payment.query.delete()
    InvoiceLine.query.delete()
    Invoice.query.delete()

    # 2. QA & Lab
    CubeTest.query.delete()
    CubeSet.query.delete()
    QcCheck.query.delete()
    MaterialTest.query.delete()

    # 3. Challans & Batch Sheets
    Challan.query.delete()
    BatchSheetRevision.query.delete()
    BatchSheet.query.delete()

    # 4. Dispatch & Trips
    Trip.query.delete()
    PurchaseOrder.query.delete()

    # 5. Customers & Sites
    # Unlink customer_id on Users to avoid FK constraints
    for u in User.query.all():
        u.customer_id = None
    db.session.flush()

    Site.query.delete()
    Customer.query.delete()

    # 6. Store & Weighbridge, DPR, TM logs & HR Records
    WeighbridgeTicket.query.delete()
    StockTransaction.query.delete()
    TransitMixerPayload.query.delete()
    TmTripLog.query.delete()
    DprRecord.query.delete()
    ExpenseRecord.query.delete()
    AttendanceRecord.query.delete()
    PayrollRun.query.delete()

    # 7. Audit & Notification Logs
    AuditLog.query.delete()
    NotificationLog.query.delete()

    # Plant Profile & Weighbridge Settings
    plant = Plant.query.filter_by(name="ROXXCON RMC NAGPUR").first() or Plant.query.first()
    if not plant:
        plant = Plant(
            id="87328a36b4cc42f5a75f6d81ce5542ba",
            name="ROXXCON RMC NAGPUR",
            address="Plot 18, MIDC Hingna Industrial Area, Nagpur, Maharashtra 440016",
            gstin="27AAACR9988D1Z2",
            phone="+91 712 288 9900",
            email="dispatch@roxxcon.in",
            city="Nagpur, Maharashtra",
            capacity="60 cum/hr",
            scada_type="CRB-75"
        )
        db.session.add(plant)
        db.session.flush()
    else:
        plant.name = "ROXXCON RMC NAGPUR"
        plant.address = "Plot 18, MIDC Hingna Industrial Area, Nagpur, Maharashtra 440016"
        plant.gstin = "27AAACR9988D1Z2"
        if not plant.city:
            plant.city = "Nagpur, Maharashtra"
        if not plant.capacity:
            plant.capacity = "60 cum/hr"
        if not plant.scada_type:
            plant.scada_type = "CRB-75"

    # 8. Reset Material Stocks to 0.0 (Clean Inventory)
    standard_materials = [
        {"name": "Cement (OPC 53)", "unit": "kg", "reorder_level": 50000.0, "density": 3.15},
        {"name": "River Sand (Zone II)", "unit": "kg", "reorder_level": 80000.0, "density": 2.65},
        {"name": "Manufactured Sand (M-Sand)", "unit": "kg", "reorder_level": 50000.0, "density": 2.60},
        {"name": "Aggregate 10mm", "unit": "kg", "reorder_level": 60000.0, "density": 2.70},
        {"name": "Aggregate 20mm", "unit": "kg", "reorder_level": 90000.0, "density": 2.70},
        {"name": "Fly Ash (Class F)", "unit": "kg", "reorder_level": 30000.0, "density": 2.20},
        {"name": "GGBS (Slag)", "unit": "kg", "reorder_level": 35000.0, "density": 2.90},
        {"name": "Water", "unit": "l", "reorder_level": 50000.0, "density": 1.0},
        {"name": "Admixture (PCE)", "unit": "l", "reorder_level": 800.0, "density": 1.08},
        {"name": "Diesel", "unit": "l", "reorder_level": 2000.0, "density": 0.85},
    ]

    for m_def in standard_materials:
        mat = Material.query.filter_by(name=m_def["name"], plant_id=plant.id).first()
        if not mat:
            mat = Material(
                name=m_def["name"],
                unit=m_def["unit"],
                current_stock=0.0,
                reorder_level=m_def["reorder_level"],
                density=m_def.get("density", 1.0),
                plant_id=plant.id
            )
            db.session.add(mat)
        else:
            mat.current_stock = 0.0
            mat.unit = m_def["unit"]
            mat.reorder_level = m_def["reorder_level"]
            mat.plant_id = plant.id

    # 9. Reset Trucks & Drivers to AVAILABLE
    standard_trucks = [
        {"tm_number": "MH40DC4288", "capacity_cum": 8.0},
        {"tm_number": "MH40DC3964", "capacity_cum": 8.0},
        {"tm_number": "MH-12-RN-1001", "capacity_cum": 8.0},
        {"tm_number": "MH-12-RN-1002", "capacity_cum": 8.0},
        {"tm_number": "MH-12-RN-1003", "capacity_cum": 8.0},
        {"tm_number": "MH-12-RN-1004", "capacity_cum": 8.0},
        {"tm_number": "MH-12-RN-1005", "capacity_cum": 8.0},
    ]
    for t_def in standard_trucks:
        tr = Truck.query.filter_by(tm_number=t_def["tm_number"]).first()
        if not tr:
            tr = Truck(tm_number=t_def["tm_number"], capacity_cum=t_def["capacity_cum"], status="AVAILABLE", plant_id=plant.id)
            db.session.add(tr)
        else:
            tr.status = "AVAILABLE"
            tr.plant_id = plant.id

    standard_drivers = [
        {"name": "VIKASH", "phone": "+91 98220 77889"},
        {"name": "Sachin More", "phone": "+91 98220 11221"},
        {"name": "Ganesh Kadam", "phone": "+91 98220 11222"},
        {"name": "Ramesh Jadhav", "phone": "+91 98220 11223"},
        {"name": "Vijay Pawar", "phone": "+91 98220 11224"},
        {"name": "Sunil Patil", "phone": "+91 98220 11225"},
    ]
    for d_def in standard_drivers:
        dr = Driver.query.filter_by(name=d_def["name"]).first()
        if not dr:
            dr = Driver(name=d_def["name"], phone=d_def["phone"], license_no=f"MH40-{d_def['name'][:3].upper()}-9988", status="AVAILABLE", plant_id=plant.id)
            db.session.add(dr)
        else:
            dr.status = "AVAILABLE"
            dr.plant_id = plant.id

    wb_set = WeighbridgeSettings.query.filter_by(plant_id=plant.id).first() or WeighbridgeSettings.query.first()
    if not wb_set:
        wb_set = WeighbridgeSettings(
            plant_id=plant.id,
            plant_name="ROXXCON RMC NAGPUR",
            wb_name="WB-01 (Inward/Outward Pitless 60T)",
            vendor_software_name="RMC Weigh Pro",
            vendor_company_name="RMC Weighbridge Automation",
            customer_care="+91 712 288 9900"
        )
        db.session.add(wb_set)
    else:
        wb_set.plant_id = plant.id
        wb_set.plant_name = "ROXXCON RMC NAGPUR"
        wb_set.wb_name = "WB-01 (Inward/Outward Pitless 60T)"

    # 10. Ensure Concrete Grades (M15 - M40) exist
    standard_grades = [
        {"code": "M15", "strength": 15.0, "s_min": 100, "s_max": 140, "rate": 3950.0, "cement": 240, "sand": 780, "agg10": 460, "agg20": 700, "water": 175, "admix": 1.2},
        {"code": "M20", "strength": 20.0, "s_min": 110, "s_max": 150, "rate": 4200.0, "cement": 280, "sand": 740, "agg10": 470, "agg20": 720, "water": 170, "admix": 1.5},
        {"code": "M25", "strength": 25.0, "s_min": 120, "s_max": 160, "rate": 4500.0, "cement": 330, "sand": 710, "agg10": 480, "agg20": 730, "water": 165, "admix": 1.8},
        {"code": "M30", "strength": 30.0, "s_min": 120, "s_max": 160, "rate": 4850.0, "cement": 370, "sand": 680, "agg10": 490, "agg20": 740, "water": 160, "admix": 2.2},
        {"code": "M35", "strength": 35.0, "s_min": 130, "s_max": 170, "rate": 5250.0, "cement": 410, "sand": 650, "agg10": 500, "agg20": 750, "water": 155, "admix": 2.5},
        {"code": "M40", "strength": 40.0, "s_min": 130, "s_max": 170, "rate": 5700.0, "cement": 450, "sand": 620, "agg10": 510, "agg20": 760, "water": 150, "admix": 2.8}
    ]
    for g_info in standard_grades:
        grade = Grade.query.filter_by(code=g_info["code"]).first()
        if not grade:
            grade = Grade(
                code=g_info["code"],
                characteristic_strength_mpa=g_info["strength"],
                slump_min_mm=g_info["s_min"],
                slump_max_mm=g_info["s_max"],
                default_rate=g_info["rate"]
            )
            db.session.add(grade)
            db.session.flush()

        if not grade.mix_design:
            mix = MixDesign(
                grade_id=grade.id,
                cement_kg=g_info["cement"],
                sand_kg=g_info["sand"],
                aggregate_10mm_kg=g_info["agg10"],
                aggregate_20mm_kg=g_info["agg20"],
                water_l=g_info["water"],
                admixture_l=g_info["admix"]
            )
            db.session.add(mix)

    # 11. Ensure Core Portal User Accounts Exist (Password: Demo@123)
    core_users = [
        {"name": "Vikramaditya Singhania", "email": "owner@rmc.test", "role": "owner", "mgr": False},
        {"name": "Ananya Sharma", "email": "sales@rmc.test", "role": "sales", "mgr": False},
        {"name": "Devendra Kulkarni", "email": "salesmanager@rmc.test", "role": "sales_manager", "mgr": True},
        {"name": "Mahesh Deshpande", "email": "dispatcher@rmc.test", "role": "dispatcher", "mgr": False},
        {"name": "Siddharth Joshi", "email": "production@rmc.test", "role": "production", "mgr": False},
        {"name": "Dr. Pradeep Sawant", "email": "qa@rmc.test", "role": "qa", "mgr": False},
        {"name": "Rajesh Gupta", "email": "store@rmc.test", "role": "store", "mgr": False},
        {"name": "Priya Nair", "email": "account@rmc.test", "role": "account", "mgr": False},
        {"name": "Santosh Shinde", "email": "supervisor@rmc.test", "role": "supervisor", "mgr": False},
        {"name": "Customer Portal User", "email": "customer1@rmc.test", "role": "customer", "mgr": False},
    ]

    for u_info in core_users:
        user = User.query.filter_by(email=u_info["email"]).first()
        if not user:
            user = User(
                name=u_info["name"],
                email=u_info["email"],
                phone="+91 98000 12345",
                role=u_info["role"],
                is_manager=u_info["mgr"],
                is_active=True
            )
            user.set_password("Demo@123")
            db.session.add(user)
        else:
            user.role = u_info["role"]
            user.is_manager = u_info["mgr"]
            user.customer_id = None
            user.is_active = True
            user.set_password("Demo@123")

    # 12. Reset Document Sequences to 0
    Sequence.query.delete()

    db.session.commit()
    print("✓ All seed, dummy, and operational data successfully purged.")
    print("✓ Database is completely clean and ready to create everything from scratch across all logins.")

def purge_dummy_data():
    app = create_app()
    with app.app_context():
        execute_purge()

if __name__ == "__main__":
    purge_dummy_data()
