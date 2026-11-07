"""
Purge and seed baseline data for the RMC database.
Preserves / Seeds:
- All 10 User login accounts (with password Demo@123 so every portal is immediately accessible)
- Plant settings and master profile (ROXXCON RMC NAGPUR)
- 4 Enterprise Construction Clients with dedicated delivery sites
- Standard Concrete Grades (M15–M40) and standard IS 10262 mix designs
- Full Material inventory with inwarded stock (Cement, Sand, Aggregates, Fly Ash, Water, Admixture, Diesel)
- Trucks & Drivers (status AVAILABLE)
- Numbering sequences
Removes:
- Transient/demo Purchase Orders & Trips
- Transient Batch Sheets, Revisions & QC Tests
- Transient Challans, Invoices & Payments
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
    print("Clearing transactional demo records...")

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

    # 5. Store & Weighbridge, DPR, TM logs & HR Records
    WeighbridgeTicket.query.delete()
    StockTransaction.query.delete()
    TransitMixerPayload.query.delete()
    TmTripLog.query.delete()
    DprRecord.query.delete()
    ExpenseRecord.query.delete()
    AttendanceRecord.query.delete()
    PayrollRun.query.delete()

    # 6. Audit & Notification Logs
    AuditLog.query.delete()
    NotificationLog.query.delete()

    # 7. Plant Profile & Weighbridge Settings
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

    # 8. Unlink customer_id on Users to avoid FK constraints, then seed 4 Enterprise Customers
    for u in User.query.all():
        u.customer_id = None
    db.session.flush()

    Site.query.delete()
    Customer.query.delete()

    enterprise_customers = [
        {
            "name": "Larsen & Toubro Ltd (L&T Construction)",
            "contact_person": "Er. Rajesh Deshmukh",
            "phone": "+91 98220 11223",
            "email": "rajesh.deshmukh@lntecc.com",
            "gstin": "27AAACL0123P1Z8",
            "address": "L&T Tech Park, Wardha Road, Nagpur, Maharashtra 440025",
            "credit_days": 45,
            "credit_limit": 5000000.0,
            "site": {
                "name": "Metro Rail Corridor Phase 2 (Pillar P-104 to P-120)",
                "address": "Wardha Road, Near Airport Station, Nagpur, Maharashtra 440025",
                "contact_person": "Nitin Bagde",
                "phone": "+91 98220 11224",
                "notes": "32T transit mixer access road clear. Dedicated wash bay available."
            }
        },
        {
            "name": "Godrej Properties Infrastructure",
            "contact_person": "Nitin Gadre",
            "phone": "+91 94231 44556",
            "email": "ngadre@godrejproperties.com",
            "gstin": "27AAACG4455K1Z3",
            "address": "Godrej Anandam Tower A, Ganeshpeth, Nagpur, Maharashtra 440018",
            "credit_days": 30,
            "credit_limit": 3500000.0,
            "site": {
                "name": "Godrej Anandam Commercial Wing Site",
                "address": "Model Mill Compound, Ganeshpeth, Nagpur, Maharashtra 440018",
                "contact_person": "Ajay Sharma",
                "phone": "+91 94231 44557",
                "notes": "Stationary line pump CP-30 stationed at basement B2."
            }
        },
        {
            "name": "Tata Projects Civil Infrastructure",
            "contact_person": "Amitabh Verma",
            "phone": "+91 97654 33221",
            "email": "averma@tataprojects.com",
            "gstin": "27AAACT9988M1Z4",
            "address": "Samruddhi Expressway Junction Package 1, Nagpur, Maharashtra",
            "credit_days": 60,
            "credit_limit": 7500000.0,
            "site": {
                "name": "Samruddhi Interchange Cloverleaf Bridge Site",
                "address": "Hingna Bypass Km 12.5, Nagpur, Maharashtra 441110",
                "contact_person": "Sandeep Patil",
                "phone": "+91 97654 33222",
                "notes": "Heavy TM access via Gate 3. Slump retention test required upon entry."
            }
        },
        {
            "name": "KEC International Power & Infra",
            "contact_person": "Vikas Rathi",
            "phone": "+91 98901 88776",
            "email": "vrathi@kecrpg.com",
            "gstin": "27AAACK1122D1Z6",
            "address": "MIDC Butibori Industrial Estate, Nagpur, Maharashtra 441122",
            "credit_days": 30,
            "credit_limit": 2500000.0,
            "site": {
                "name": "400kV Substation Transmission Foundation Site",
                "address": "Plot 45, Butibori Industrial Area, Nagpur, Maharashtra 441122",
                "contact_person": "Manoj Kulkarni",
                "phone": "+91 98901 88777",
                "notes": "Safety induction mandatory for TM drivers. Boom pump clearance active."
            }
        }
    ]

    first_customer = None
    for c_data in enterprise_customers:
        site_info = c_data.pop("site")
        cust = Customer(
            name=c_data["name"],
            contact_person=c_data["contact_person"],
            phone=c_data["phone"],
            email=c_data["email"],
            gstin=c_data["gstin"],
            address=c_data["address"],
            credit_days=c_data["credit_days"],
            credit_limit=c_data["credit_limit"],
            plant_id=plant.id
        )
        db.session.add(cust)
        db.session.flush()

        if not first_customer:
            first_customer = cust

        site = Site(
            customer_id=cust.id,
            name=site_info["name"],
            address=site_info["address"],
            contact_person=site_info["contact_person"],
            phone=site_info["phone"],
            accessibility_notes=site_info["notes"]
        )
        db.session.add(site)

    # 9. Inward Full Material Inventory with official Inward Weighbridge Tickets & Ledgers
    now = datetime.now(timezone.utc)
    now_str = now.isoformat()

    standard_materials = [
        {"name": "Cement (OPC 53)", "unit": "kg", "initial_stock": 35000.0, "reorder_level": 50000.0, "density": 3.15, "supplier": "UltraTech Cement Ltd (Bulk Tanker)", "vehicle": "MH-40-BL-1122"},
        {"name": "River Sand (Zone II)", "unit": "kg", "initial_stock": 45000.0, "reorder_level": 80000.0, "density": 2.65, "supplier": "Narmada River Sands (Tipper 45T)", "vehicle": "MH-40-TR-3344"},
        {"name": "Manufactured Sand (M-Sand)", "unit": "kg", "initial_stock": 45000.0, "reorder_level": 50000.0, "density": 2.60, "supplier": "Vashishta Quarry Mines (VSI M-Sand)", "vehicle": "MH-40-TR-5566"},
        {"name": "Aggregate 10mm", "unit": "kg", "initial_stock": 50000.0, "reorder_level": 60000.0, "density": 2.70, "supplier": "Hingna Stone Crushers (Blue Metal 10mm)", "vehicle": "MH-40-TR-7788"},
        {"name": "Aggregate 20mm", "unit": "kg", "initial_stock": 60000.0, "reorder_level": 90000.0, "density": 2.70, "supplier": "Hingna Stone Crushers (Blue Metal 20mm)", "vehicle": "MH-40-TR-9900"},
        {"name": "Fly Ash (Class F)", "unit": "kg", "initial_stock": 30000.0, "reorder_level": 30000.0, "density": 2.20, "supplier": "Koradi Thermal Power Station (Bulker)", "vehicle": "MH-40-BL-2233"},
        {"name": "GGBS (Slag)", "unit": "kg", "initial_stock": 30000.0, "reorder_level": 35000.0, "density": 2.90, "supplier": "JSW Cement Ltd (Bulk Tanker)", "vehicle": "MH-40-BL-4455"},
        {"name": "Water", "unit": "l", "initial_stock": 50000.0, "reorder_level": 50000.0, "density": 1.0, "supplier": "MIDC Hingna Industrial Pipeline", "vehicle": "MIDC-PIPE-01"},
        {"name": "Admixture (PCE)", "unit": "l", "initial_stock": 1200.0, "reorder_level": 800.0, "density": 1.08, "supplier": "Sika India Pvt Ltd (Plastiment PCE)", "vehicle": "MH-12-CM-8899"},
        {"name": "Diesel", "unit": "l", "initial_stock": 6000.0, "reorder_level": 2000.0, "density": 0.85, "supplier": "Indian Oil Corporation Ltd (Fuel Bowser)", "vehicle": "MH-40-FL-9911"},
    ]

    for idx, m_def in enumerate(standard_materials, 1):
        mat = Material.query.filter_by(name=m_def["name"], plant_id=plant.id).first()
        init_qty = m_def["initial_stock"]
        if not mat:
            mat = Material(
                name=m_def["name"],
                unit=m_def["unit"],
                current_stock=init_qty,
                reorder_level=m_def["reorder_level"],
                density=m_def.get("density", 1.0),
                plant_id=plant.id,
                is_active=True
            )
            db.session.add(mat)
            db.session.flush()
        else:
            mat.current_stock = init_qty
            mat.unit = m_def["unit"]
            mat.reorder_level = m_def["reorder_level"]
            mat.plant_id = plant.id
            mat.is_active = True

        # Inward Weighbridge Ticket
        wb_ticket = WeighbridgeTicket(
            ticket_number=f"WB-INW-{idx:04d}",
            type="INWARD",
            vehicle_number=m_def["vehicle"],
            material=mat.name,
            supplier_or_customer=m_def["supplier"],
            gross_weight=round(init_qty * 1.35, 1),
            tare_weight=round(init_qty * 0.35, 1),
            net_weight=init_qty,
            gross_time=now_str,
            tare_time=now_str,
            status="COMPLETED",
            variance=0.0,
            challan_weight=init_qty,
            received_rs=0.0,
            wb_name="Gate Scale #1",
            driver_name="Consignment Delivery Driver",
            watchman_name="Ganesh S (Gate Security)",
            gate_pass_no=f"GP-INW-{idx:04d}",
            plant_id=plant.id
        )
        db.session.add(wb_ticket)

        # Stock Transaction Ledger Entry
        tx = StockTransaction(
            material_id=mat.id,
            type="IN",
            quantity=init_qty,
            reference=f"WB-INW-{idx:04d}",
            note=f"Initial Silo & Bay Consignment Inwarded from {m_def['supplier']}",
            created_by="Store Inventory Manager"
        )
        db.session.add(tx)

    # 10. Reset Trucks & Drivers to AVAILABLE
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

    # 11. Concrete Grades (M15 - M40)
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

    # 12. Ensure Core Portal User Accounts Exist (Password: Demo@123)
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
                is_active=True,
                plant_id=plant.id
            )
            user.set_password("Demo@123")
            db.session.add(user)
        else:
            user.role = u_info["role"]
            user.is_manager = u_info["mgr"]
            user.plant_id = plant.id
            user.is_active = True
            user.set_password("Demo@123")

        # Link customer user to Customer 1
        if user.email == "customer1@rmc.test" and first_customer:
            user.customer_id = first_customer.id

    # 13. Reset Document Sequences to 0
    Sequence.query.delete()

    db.session.commit()
    print("✓ All 4 Enterprise Customers and delivery sites seeded.")
    print("✓ All raw materials inwarded with official gate weighbridge receipts & ledger entries.")
    print("✓ Plant database is completely initialized and ready for production batching.")

def purge_dummy_data():
    app = create_app()
    with app.app_context():
        execute_purge()

if __name__ == "__main__":
    purge_dummy_data()
