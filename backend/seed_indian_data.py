"""
Seed high-quality, realistic Indian dummy data for Sai/ABC Ready Mix Concrete Plant.
Names: Rahul Wagh, Ritesh Shinde, Santosh Patil, Anand Kulkarni, Sachin More, Nitin Deshmukh.
Locations: Baner, Hinjewadi, Wakad, Balewadi, Chakan (Pune/Maharashtra region).
"""

import sys
import os
from datetime import datetime, date, timedelta, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app import create_app
from backend.app.extensions import db
from backend.app.models.models import (
    Customer, Site, Grade, MixDesign, PurchaseOrder, Trip, BatchSheet,
    Challan, QcCheck, CubeSet, CubeTest, Invoice, InvoiceLine, Payment,
    WeighbridgeTicket, StockTransaction, Material, Truck, Driver,
    DprRecord, ExpenseRecord, AttendanceRecord, Sequence, User
)
from backend.purge_dummy_data import purge_dummy_data

def seed_indian_data():
    app = create_app()
    with app.app_context():
        # First, purge old records cleanly
        purge_dummy_data()
        print("\nSeeding realistic Indian operational data...")

        # 1. Update Drivers with Indian names
        driver_names = [
            ("Rahul Wagh", "+91 98901 11223", "MH12-2018-0045210"),
            ("Ritesh Shinde", "+91 98902 22334", "MH12-2019-0098341"),
            ("Santosh Patil", "+91 98903 33445", "MH14-2017-0012890"),
            ("Sachin More", "+91 98904 44556", "MH12-2020-0067123"),
            ("Ganesh Kadam", "+91 98905 55667", "MH14-2016-0043901"),
            ("Ramesh Jadhav", "+91 98906 66778", "MH12-2019-0081234"),
            ("Vijay Pawar", "+91 98907 77889", "MH12-2021-0023456"),
            ("Amit Shinde", "+91 98908 88990", "MH14-2018-0078901"),
            ("Sunil Gaikwad", "+91 98909 99001", "MH12-2017-0056789"),
            ("Deepak Bhosale", "+91 98910 10112", "MH14-2020-0034567"),
        ]

        existing_drivers = Driver.query.all()
        for idx, (name, phone, lic) in enumerate(driver_names):
            if idx < len(existing_drivers):
                d = existing_drivers[idx]
                d.name = name
                d.phone = phone
                d.license_no = lic
                d.status = "AVAILABLE"
            else:
                d = Driver(name=name, phone=phone, license_no=lic, status="AVAILABLE")
                db.session.add(d)

        db.session.commit()
        drivers = Driver.query.all()
        trucks = Truck.query.all()

        # 2. Seed Raw Material Stocks
        mat_stocks = {
            "OPC 53 Cement": 85000.0,
            "Fly Ash": 45000.0,
            "20mm Aggregate": 140000.0,
            "10mm Aggregate": 110000.0,
            "Crushed Sand (VSI)": 190000.0,
            "Chemical Admixture": 3200.0,
            "Water": 120000.0,
            "Diesel": 8500.0,
        }
        for mat in Material.query.all():
            for key, val in mat_stocks.items():
                if key.lower() in mat.name.lower():
                    mat.current_stock = val
                    break
        db.session.commit()

        # 3. Seed Customers
        c1 = Customer(
            name="Wagh Infra Projects Pvt Ltd",
            contact_person="Rahul Wagh",
            phone="+91 98200 11223",
            email="rahul.wagh@waghinfra.in",
            gstin="27AABCW1234F1Z5",
            address="Plot 104, High Street, Baner, Pune - 411045",
            credit_days=30,
            credit_limit=6000000.0
        )
        c2 = Customer(
            name="Shinde Builders & Developers",
            contact_person="Ritesh Shinde",
            phone="+91 98201 44556",
            email="ritesh.shinde@shindebuilders.com",
            gstin="27AABCS5678G1Z2",
            address="Shinde Chambers, Hinjewadi Phase 1, Pune - 411057",
            credit_days=45,
            credit_limit=7500000.0
        )
        c3 = Customer(
            name="Patil Infratech Infrastructure",
            contact_person="Santosh Patil",
            phone="+91 98202 77889",
            email="santosh@patilinfra.in",
            gstin="27AABCP9012H1Z8",
            address="Wakad Bridge Junction, Pune - 411057",
            credit_days=30,
            credit_limit=4000000.0
        )
        c4 = Customer(
            name="Kulkarni Mega Constructions",
            contact_person="Anand Kulkarni",
            phone="+91 98203 99001",
            email="anand@kulkarnigroup.co.in",
            gstin="27AABCK3456J1Z1",
            address="Senapati Bapat Road, Pune - 411016",
            credit_days=60,
            credit_limit=10000000.0
        )
        db.session.add_all([c1, c2, c3, c4])
        db.session.commit()

        # Link portal customer logins to realistic customers
        u_cust1 = User.query.filter_by(email="customer1@rmc.test").first()
        if u_cust1:
            u_cust1.customer_id = c1.id
            u_cust1.name = "Rahul Wagh"
        u_cust2 = User.query.filter_by(email="customer2@rmc.test").first()
        if u_cust2:
            u_cust2.customer_id = c2.id
            u_cust2.name = "Ritesh Shinde"
        db.session.commit()

        # 4. Seed Delivery Sites
        s1 = Site(
            customer_id=c1.id,
            name="Wagh Business Bay - Tower A",
            address="Survey 42/1, Baner High Street, Pune - 411045",
            contact_person="Rahul Wagh",
            phone="+91 98200 11223",
            accessibility_notes="Wide 40ft approach road. 42m boom pump clearance verified."
        )
        s2 = Site(
            customer_id=c1.id,
            name="Wagh Imperial Greens - Phase 2",
            address="Near Balewadi Sports Complex, Pune - 411045",
            contact_person="Rahul Wagh",
            phone="+91 98200 11223",
            accessibility_notes="24-hour pour allowed. Entry via South Gate #2."
        )
        s3 = Site(
            customer_id=c2.id,
            name="Shinde Heights Commercial Complex",
            address="Opposite Tech Mahindra, Hinjewadi Phase 1, Pune - 411057",
            contact_person="Ritesh Shinde",
            phone="+91 98201 44556",
            accessibility_notes="Entry from West Gate. Overhead electric cable clearance 6.5 meters."
        )
        s4 = Site(
            customer_id=c2.id,
            name="Shinde Palm County Villas",
            address="Marunji Road, Hinjewadi Extension, Pune - 411057",
            contact_person="Ritesh Shinde",
            phone="+91 98201 44556",
            accessibility_notes="Residential zone. Concrete pouring permitted between 8:00 AM - 6:00 PM."
        )
        s5 = Site(
            customer_id=c3.id,
            name="Patil Prime Logistics Park",
            address="Chakan MIDC Phase 2, Pune - 410501",
            contact_person="Santosh Patil",
            phone="+91 98202 77889",
            accessibility_notes="Heavy 10-wheel transit mixer access. In-house weighbridge check."
        )
        s6 = Site(
            customer_id=c4.id,
            name="Kulkarni Riverview Residences",
            address="Kharadi Riverside Road, Pune - 411014",
            contact_person="Anand Kulkarni",
            phone="+91 98203 99001",
            accessibility_notes="Stationary line pump required for 14th floor podium slab."
        )
        db.session.add_all([s1, s2, s3, s4, s5, s6])
        db.session.commit()

        # 5. Fetch Grades
        grades = {g.code: g for g in Grade.query.all()}
        m25 = grades.get("M25")
        m30 = grades.get("M30")
        m35 = grades.get("M35")
        m40 = grades.get("M40")

        sales_user = User.query.filter_by(role="sales").first()
        sales_mgr = User.query.filter_by(role="sales_manager").first()
        owner_user = User.query.filter_by(role="owner").first()

        now = datetime.now(timezone.utc)
        today = date.today()

        # 6. Seed Purchase Orders
        # PO 1: IN_PROGRESS (Partially delivered with trips)
        po1 = PurchaseOrder(
            po_number="PO-2026-0001",
            customer_id=c1.id,
            site_id=s1.id,
            grade_id=m35.id,
            quantity_cum=24.0,
            rate_per_cum=4650.0,
            delivery_datetime=now + timedelta(hours=2),
            purpose="Slab",
            pump_required=True,
            pump_ownership="Company Pump",
            pump_type="Horizontal",
            pipeline_length=90,
            workers_required=4,
            payment_terms_days=30,
            status="IN_PROGRESS",
            created_by=sales_user.id if sales_user else None,
            submitted_at=now - timedelta(days=1),
            approved_by=sales_mgr.id if sales_mgr else None,
            approved_at=now - timedelta(days=1),
            approval_remarks="Approved for Wagh Business Bay 7th floor slab."
        )

        # PO 2: APPROVED (Ready for Dispatcher to plan trips)
        po2 = PurchaseOrder(
            po_number="PO-2026-0002",
            customer_id=c2.id,
            site_id=s3.id,
            grade_id=m30.id,
            quantity_cum=32.0,
            rate_per_cum=4250.0,
            delivery_datetime=now + timedelta(hours=5),
            purpose="Column",
            pump_required=True,
            pump_ownership="Customer Pump",
            pump_type="Vertical",
            pipeline_length=120,
            workers_required=6,
            payment_terms_days=45,
            status="APPROVED",
            created_by=sales_user.id if sales_user else None,
            submitted_at=now - timedelta(hours=6),
            approved_by=sales_mgr.id if sales_mgr else None,
            approved_at=now - timedelta(hours=4),
            approval_remarks="Approved by Ritesh Shinde order confirmation."
        )

        # PO 3: SUBMITTED (Pending review in Sales Approvals tab)
        po3 = PurchaseOrder(
            po_number="PO-2026-0003",
            customer_id=c1.id,
            site_id=s2.id,
            grade_id=m25.id,
            quantity_cum=18.0,
            rate_per_cum=3950.0,
            delivery_datetime=now + timedelta(days=1),
            purpose="Footing",
            pump_required=False,
            payment_terms_days=30,
            status="SUBMITTED",
            created_by=sales_user.id if sales_user else None,
            submitted_at=now - timedelta(hours=1),
            notes="Foundation footing pour. Direct chute discharge possible."
        )

        # PO 4: APPROVED
        po4 = PurchaseOrder(
            po_number="PO-2026-0004",
            customer_id=c3.id,
            site_id=s5.id,
            grade_id=m40.id,
            quantity_cum=40.0,
            rate_per_cum=5100.0,
            delivery_datetime=now + timedelta(days=2),
            purpose="Pavement",
            pump_required=False,
            payment_terms_days=30,
            status="APPROVED",
            created_by=sales_user.id if sales_user else None,
            submitted_at=now - timedelta(hours=8),
            approved_by=sales_mgr.id if sales_mgr else None,
            approved_at=now - timedelta(hours=5),
            approval_remarks="Approved for Chakan industrial heavy-duty pavement."
        )

        db.session.add_all([po1, po2, po3, po4])
        db.session.commit()

        # 7. Seed Trips for PO 1
        t1 = Trip(
            trip_number="TRIP-2026-0001",
            po_id=po1.id,
            truck_id=trucks[0].id if trucks else None,
            driver_id=drivers[0].id if drivers else None,  # Rahul Wagh
            sequence=1,
            quantity_cum=8.0,
            planned_datetime=now - timedelta(hours=3),
            dispatched_at=now - timedelta(hours=2, minutes=30),
            delivered_at=now - timedelta(hours=1),
            delivered_quantity=8.0,
            receiver_name="Rahul Wagh",
            status="DELIVERED",
            notes="Smooth pour. Cube set cast on site."
        )

        t2 = Trip(
            trip_number="TRIP-2026-0002",
            po_id=po1.id,
            truck_id=trucks[1].id if len(trucks) > 1 else None,
            driver_id=drivers[1].id if len(drivers) > 1 else None,  # Ritesh Shinde
            sequence=2,
            quantity_cum=8.0,
            planned_datetime=now - timedelta(hours=1, minutes=30),
            dispatched_at=now - timedelta(minutes=45),
            status="IN_TRANSIT",
            notes="En route to Baner High Street via Highway."
        )

        t3 = Trip(
            trip_number="TRIP-2026-0003",
            po_id=po1.id,
            truck_id=trucks[2].id if len(trucks) > 2 else None,
            driver_id=drivers[2].id if len(drivers) > 2 else None,  # Santosh Patil
            sequence=3,
            quantity_cum=8.0,
            planned_datetime=now,
            status="QC_APPROVED",
            notes="Batched & slump verified. Ready for gate release."
        )

        db.session.add_all([t1, t2, t3])
        db.session.commit()

        # Update truck statuses to match
        if len(trucks) > 0: trucks[0].status = "AVAILABLE"
        if len(trucks) > 1: trucks[1].status = "IN_TRANSIT"
        if len(trucks) > 2: trucks[2].status = "LOADED"
        db.session.commit()

        # 8. Seed Batch Sheets
        bs1 = BatchSheet(
            batch_number="BS-2026-0001",
            trip_id=t1.id,
            grade_id=m35.id,
            quantity_cum=8.0,
            cement_kg=3120.0,
            sand_kg=5680.0,
            agg_10_kg=3600.0,
            agg_20_kg=5400.0,
            water_l=1280.0,
            admixture_l=24.0,
            batched_at=now - timedelta(hours=2, minutes=45),
            qc_status="APPROVED",
            qc_signed_by="Nitin Deshmukh",
            qc_signed_at=now - timedelta(hours=2, minutes=35)
        )

        bs2 = BatchSheet(
            batch_number="BS-2026-0002",
            trip_id=t2.id,
            grade_id=m35.id,
            quantity_cum=8.0,
            cement_kg=3125.0,
            sand_kg=5675.0,
            agg_10_kg=3610.0,
            agg_20_kg=5390.0,
            water_l=1275.0,
            admixture_l=24.2,
            batched_at=now - timedelta(hours=1),
            qc_status="APPROVED",
            qc_signed_by="Nitin Deshmukh",
            qc_signed_at=now - timedelta(minutes=50)
        )

        bs3 = BatchSheet(
            batch_number="BS-2026-0003",
            trip_id=t3.id,
            grade_id=m35.id,
            quantity_cum=8.0,
            cement_kg=3120.0,
            sand_kg=5680.0,
            agg_10_kg=3605.0,
            agg_20_kg=5395.0,
            water_l=1280.0,
            admixture_l=24.0,
            batched_at=now - timedelta(minutes=20),
            qc_status="APPROVED",
            qc_signed_by="Nitin Deshmukh",
            qc_signed_at=now - timedelta(minutes=10)
        )

        db.session.add_all([bs1, bs2, bs3])
        db.session.commit()

        # 9. Seed Delivery Challans
        ch1 = Challan(
            challan_number="CH-2026-0001",
            trip_id=t1.id,
            issued_at=now - timedelta(hours=2, minutes=30),
            printed_copies=3,
            released_by="Rahul Wagh (Gate Security)"
        )
        ch2 = Challan(
            challan_number="CH-2026-0002",
            trip_id=t2.id,
            issued_at=now - timedelta(minutes=45),
            printed_copies=3,
            released_by="Rahul Wagh (Gate Security)"
        )
        db.session.add_all([ch1, ch2])
        db.session.commit()

        # 10. Seed QC Checks
        qc1 = QcCheck(
            trip_id=t1.id,
            batch_sheet_id=bs1.id,
            physical_inspection_ok=True,
            slump_mm=125,
            bleeding_ok=True,
            wrong_mix_ok=True,
            admixture_type="PCE Superplasticizer",
            admixture_qty=24.0,
            decision="APPROVE",
            remarks="Excellent cohesion and workability. Slump 125mm within ±25mm tolerance.",
            checked_by="Nitin Deshmukh",
            checked_at=now - timedelta(hours=2, minutes=35)
        )
        qc2 = QcCheck(
            trip_id=t2.id,
            batch_sheet_id=bs2.id,
            physical_inspection_ok=True,
            slump_mm=130,
            bleeding_ok=True,
            wrong_mix_ok=True,
            admixture_type="PCE Superplasticizer",
            admixture_qty=24.2,
            decision="APPROVE",
            remarks="Slump 130mm OK for 42m boom pumping.",
            checked_by="Nitin Deshmukh",
            checked_at=now - timedelta(minutes=50)
        )
        db.session.add_all([qc1, qc2])
        db.session.commit()

        # 11. Seed Cube Set & Tests for Trip 1
        cube_set = CubeSet(
            batch_sheet_id=bs1.id,
            trip_id=t1.id,
            cast_date=today - timedelta(days=7),
            cube_count=6
        )
        db.session.add(cube_set)
        db.session.commit()

        t_7day = CubeTest(
            cube_set_id=cube_set.id,
            age_days=7,
            due_date=today,
            tested_on=today,
            strength_mpa=29.8,
            result="PASS",
            tested_by="Nitin Deshmukh"
        )
        t_28day = CubeTest(
            cube_set_id=cube_set.id,
            age_days=28,
            due_date=today + timedelta(days=21),
            result="PENDING"
        )
        db.session.add_all([t_7day, t_28day])
        db.session.commit()

        # 12. Seed Invoice & Payment for Trip 1
        inv1 = Invoice(
            invoice_number="INV-2026-0001",
            customer_id=c1.id,
            po_id=po1.id,
            issue_date=today,
            due_date=today + timedelta(days=30),
            subtotal=37200.0,  # 8 cum * 4650
            gst_percent=18.0,
            total=43896.0,
            status="PAID"
        )
        db.session.add(inv1)
        db.session.commit()

        line1 = InvoiceLine(
            invoice_id=inv1.id,
            trip_id=t1.id,
            quantity=8.0,
            rate=4650.0,
            amount=37200.0
        )
        pay1 = Payment(
            invoice_id=inv1.id,
            amount=43896.0,
            paid_on=today,
            mode="NEFT",
            reference="HDFCN26298014521",
            recorded_by="Rahul Wagh (Accounts)"
        )
        db.session.add_all([line1, pay1])
        db.session.commit()

        # 13. Seed Weighbridge Tickets
        wb1 = WeighbridgeTicket(
            ticket_number="TK65501",
            type="INWARD",
            vehicle_number="MH 12 RN 4501",
            material="OPC 53 Cement",
            supplier_or_customer="Ultratech Cement Ltd",
            gross_weight=38450.0,
            tare_weight=13200.0,
            net_weight=25250.0,
            gross_time="08:15:20",
            tare_time="08:42:10",
            status="COMPLETED",
            variance=0.0,
            challan_weight=25250.0,
            wb_name="Weighbridge #1",
            driver_name="Rahul Wagh",
            gate_pass_no="GP-4512"
        )
        wb2 = WeighbridgeTicket(
            ticket_number="TK65502",
            type="INWARD",
            vehicle_number="MH 14 BJ 8892",
            material="20mm Aggregate",
            supplier_or_customer="Mahalaxmi Stone Crusher",
            gross_weight=42100.0,
            tare_weight=14050.0,
            net_weight=28050.0,
            gross_time="09:10:00",
            tare_time="09:35:15",
            status="COMPLETED",
            variance=-50.0,
            challan_weight=28100.0,
            wb_name="Weighbridge #1",
            driver_name="Santosh Patil",
            gate_pass_no="GP-4513"
        )
        wb3 = WeighbridgeTicket(
            ticket_number="TK65503",
            type="INWARD",
            vehicle_number="MH 12 EQ 3314",
            material="Crushed Sand (VSI)",
            supplier_or_customer="Shivam Sand Suppliers",
            gross_weight=39800.0,
            tare_weight=13400.0,
            net_weight=26400.0,
            gross_time="10:05:40",
            tare_time="10:28:10",
            status="COMPLETED",
            variance=0.0,
            challan_weight=26400.0,
            wb_name="Weighbridge #1",
            driver_name="Ganesh Kadam",
            gate_pass_no="GP-4514"
        )
        wb4 = WeighbridgeTicket(
            ticket_number="TK65504",
            type="OUTWARD",
            vehicle_number="MH 12 RN 8801 (TM-01)",
            material="Ready Mix Concrete M35",
            supplier_or_customer="Wagh Infra Projects Pvt Ltd",
            gross_weight=28450.0,
            tare_weight=13250.0,
            net_weight=15200.0,
            gross_time="10:45:00",
            tare_time="10:20:00",
            status="COMPLETED",
            wb_name="Weighbridge #1",
            driver_name="Rahul Wagh",
            gate_pass_no="GP-4515"
        )
        db.session.add_all([wb1, wb2, wb3, wb4])
        db.session.commit()

        # 14. Seed HR Attendance
        att1 = AttendanceRecord(
            type="DRIVER",
            name="Rahul Wagh",
            designation_or_vehicle="TM-01 (Ashok Leyland 8 m³)",
            shift="Day",
            trips_or_tasks=3,
            status="PRESENT",
            sync_source="Biometric"
        )
        att2 = AttendanceRecord(
            type="DRIVER",
            name="Ritesh Shinde",
            designation_or_vehicle="TM-02 (Benz 8 m³)",
            shift="Day",
            trips_or_tasks=2,
            status="ON_TRIP",
            sync_source="Biometric"
        )
        att3 = AttendanceRecord(
            type="DRIVER",
            name="Santosh Patil",
            designation_or_vehicle="TM-03 (TATA 8 m³)",
            shift="Day",
            trips_or_tasks=2,
            status="PRESENT",
            sync_source="Biometric"
        )
        att4 = AttendanceRecord(
            type="STAFF",
            name="Nitin Deshmukh",
            designation_or_vehicle="Quality In-Charge / QC Lab",
            shift="Day",
            trips_or_tasks=5,
            status="PRESENT",
            sync_source="Biometric"
        )
        att5 = AttendanceRecord(
            type="STAFF",
            name="Sachin More",
            designation_or_vehicle="Batching Plant Operator",
            shift="Day",
            trips_or_tasks=3,
            status="PRESENT",
            sync_source="UBITECH"
        )
        db.session.add_all([att1, att2, att3, att4, att5])
        db.session.commit()

        # 15. Seed Expenses
        exp1 = ExpenseRecord(
            category="Diesel",
            vendor="Indian Oil Corporation Bulk Depot",
            bill_no="IOC-PUN-8921",
            date=today.strftime("%Y-%m-%d"),
            amount=48500.0,
            status="PAID",
            description="500L Diesel for Transit Mixers TM-01, TM-02 and Generator"
        )
        exp2 = ExpenseRecord(
            category="Aggregate",
            vendor="Mahalaxmi Stone Crusher",
            bill_no="MSC-2026-4412",
            date=today.strftime("%Y-%m-%d"),
            amount=65000.0,
            status="PAID",
            description="Inward delivery of 28.05 tons 20mm blue metal aggregate"
        )
        exp3 = ExpenseRecord(
            category="Vehicle Maintenance",
            vendor="Shree Ganesh Auto Garage",
            bill_no="SGG-902",
            date=(today - timedelta(days=2)).strftime("%Y-%m-%d"),
            amount=12400.0,
            status="PAID",
            description="Hydraulic drum motor oil change and seal replacement for TM-02"
        )
        exp4 = ExpenseRecord(
            category="Land Bills",
            vendor="Mulkhed Gram Panchayat",
            bill_no="MGP-Q1-2026",
            date=today.strftime("%Y-%m-%d"),
            amount=80000.0,
            status="PENDING",
            description="Quarterly plant yard lease and municipal industrial ground rent"
        )
        db.session.add_all([exp1, exp2, exp3, exp4])
        db.session.commit()

        # 16. Update Sequences
        curr_year = now.year
        for sname, val in [("PO", 4), ("TRIP", 3), ("BATCH", 3), ("CHALLAN", 2), ("INVOICE", 1)]:
            seq = Sequence.query.filter_by(name=sname, year=curr_year).first()
            if not seq:
                seq = Sequence(name=sname, year=curr_year, last_value=val)
                db.session.add(seq)
            else:
                seq.last_value = val
        db.session.commit()

        print("\n✓ Realistic Indian dummy data successfully seeded into SQLite!")
        print(f"  • Customers: {Customer.query.count()} (Wagh Infra, Shinde Builders, Patil Infratech, Kulkarni Mega)")
        print(f"  • Sites: {Site.query.count()} (Baner, Hinjewadi, Wakad, Chakan, Kharadi)")
        print(f"  • Drivers: {Driver.query.count()} (Rahul Wagh, Ritesh Shinde, Santosh Patil, etc.)")
        print(f"  • Purchase Orders: {PurchaseOrder.query.count()} (PO-2026-0001 to PO-2026-0004)")
        print(f"  • Dispatches / Trips: {Trip.query.count()} (Delivered, In-Transit, QC-Approved)")
        print(f"  • Batch Sheets: {BatchSheet.query.count()}")
        print(f"  • Delivery Challans: {Challan.query.count()}")
        print(f"  • QC Slump & Cube Tests: {QcCheck.query.count()} checks, {CubeTest.query.count()} tests")
        print(f"  • Invoices & Payments: {Invoice.query.count()} invoices, {Payment.query.count()} payments")
        print(f"  • Weighbridge Tickets: {WeighbridgeTicket.query.count()}")
        print(f"  • HR Attendance & Expenses: {AttendanceRecord.query.count()} attendance, {ExpenseRecord.query.count()} expenses")

if __name__ == "__main__":
    seed_indian_data()
