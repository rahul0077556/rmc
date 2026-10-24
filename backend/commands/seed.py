import click
from datetime import datetime, timezone, timedelta, date
from flask.cli import with_appcontext
from backend.app.extensions import db
from backend.app.models.models import (
    Plant, User, Customer, Site, Grade, MixDesign, Material,
    Truck, Driver, PurchaseOrder, Trip, BatchSheet, BatchSheetRevision,
    QcCheck, CubeSet, CubeTest, MaterialTest, Challan, Invoice,
    InvoiceLine, Payment, NotificationLog, Sequence, StockTransaction,
    WeighbridgeTicket, TransitMixerPayload, DprRecord, ExpenseRecord,
    AttendanceRecord, WeighbridgeSettings, Employee, PayrollRun
)

@click.command("seed")
@with_appcontext
def seed_cli():
    """Seed the database with realistic demo data for RMC plant."""
    click.echo("Starting database seed...")
    db.drop_all()
    db.create_all()

    now = datetime.now(timezone.utc)
    today = now.date()

    # 1. PLANT
    plant = Plant(
        name="Sai ReadyMix Concrete Plant - Pune",
        address="Plot 42, Hinjewadi Industrial Phase II, Pune, Maharashtra 411057",
        gstin="27AABCA1234F1Z9",
        phone="+91 20 6789 0100",
        email="plant.admin@saireadymix.in"
    )
    db.session.add(plant)

    # 2. MATERIALS
    materials_data = [
        {"name": "Cement (OPC 53)", "unit": "kg", "current_stock": 185000.0, "reorder_level": 50000.0},
        {"name": "River Sand (Zone II)", "unit": "kg", "current_stock": 320000.0, "reorder_level": 80000.0},
        {"name": "Aggregate 10mm", "unit": "kg", "current_stock": 260000.0, "reorder_level": 60000.0},
        {"name": "Aggregate 20mm", "unit": "kg", "current_stock": 380000.0, "reorder_level": 90000.0},
        {"name": "Fly Ash (Class F)", "unit": "kg", "current_stock": 95000.0, "reorder_level": 30000.0},
        {"name": "GGBS (Slag)", "unit": "kg", "current_stock": 110000.0, "reorder_level": 35000.0},
        {"name": "Water", "unit": "l", "current_stock": 500000.0, "reorder_level": 50000.0},
        {"name": "Admixture (PCE)", "unit": "l", "current_stock": 4200.0, "reorder_level": 800.0},
    ]
    materials = {}
    for m in materials_data:
        mat = Material(**m)
        db.session.add(mat)
        materials[m["name"]] = mat
    db.session.flush()

    # 3. GRADES & MIX DESIGNS (M15 to M40)
    grades_info = [
        {"code": "M15", "strength": 15.0, "s_min": 100, "s_max": 140, "rate": 3950.0, "cement": 240, "sand": 780, "agg10": 460, "agg20": 700, "water": 175, "admix": 1.2},
        {"code": "M20", "strength": 20.0, "s_min": 110, "s_max": 150, "rate": 4200.0, "cement": 280, "sand": 740, "agg10": 470, "agg20": 720, "water": 170, "admix": 1.5},
        {"code": "M25", "strength": 25.0, "s_min": 120, "s_max": 160, "rate": 4500.0, "cement": 330, "sand": 710, "agg10": 480, "agg20": 730, "water": 165, "admix": 1.8},
        {"code": "M30", "strength": 30.0, "s_min": 120, "s_max": 160, "rate": 4850.0, "cement": 370, "sand": 680, "agg10": 490, "agg20": 740, "water": 160, "admix": 2.2},
        {"code": "M35", "strength": 35.0, "s_min": 130, "s_max": 170, "rate": 5250.0, "cement": 410, "sand": 650, "agg10": 500, "agg20": 750, "water": 155, "admix": 2.5},
        {"code": "M40", "strength": 40.0, "s_min": 130, "s_max": 170, "rate": 5700.0, "cement": 450, "sand": 620, "agg10": 510, "agg20": 760, "water": 150, "admix": 2.8}
    ]
    grades = {}
    for g in grades_info:
        grade = Grade(
            code=g["code"],
            characteristic_strength_mpa=g["strength"],
            slump_min_mm=g["s_min"],
            slump_max_mm=g["s_max"],
            default_rate=g["rate"]
        )
        db.session.add(grade)
        db.session.flush()
        grades[g["code"]] = grade

        mix = MixDesign(
            grade_id=grade.id,
            cement_kg=g["cement"],
            sand_kg=g["sand"],
            aggregate_10mm_kg=g["agg10"],
            aggregate_20mm_kg=g["agg20"],
            water_l=g["water"],
            admixture_l=g["admix"]
        )
        db.session.add(mix)

    # 4. CUSTOMERS & SITES (6 customers, 2 sites each, varying credit days)
    cust_specs = [
        {
            "name": "Kirloskar Infrastructure Pvt Ltd", "contact": "Rajiv Deshmukh", "phone": "+91 98220 11223", "email": "rajiv@kirloskarinfra.com",
            "gstin": "27AAACK1122D1Z4", "credit_days": 45, "credit_limit": 2500000.0, "address": "Kirloskar Bhavan, Senapati Bapat Road, Pune",
            "sites": [
                {"name": "Kirloskar Tech Park - Tower C", "address": "Phase 1, Hinjewadi, Pune", "contact": "Milind Patil", "phone": "+91 98221 22334", "access": "Entry through Gate 3, 40ft road"},
                {"name": "Riverview Residency", "address": "Baner Riverside, Pune", "contact": "Suresh Kale", "phone": "+91 98221 22335", "access": "Narrow bridge on approach, max 8 cum TM"}
            ]
        },
        {
            "name": "VTP Realty & Developers", "contact": "Sanjay Chordiya", "phone": "+91 98230 44556", "email": "procurement@vtprealty.in",
            "gstin": "27AAACV4455C1Z1", "credit_days": 30, "credit_limit": 3500000.0, "address": "VTP House, Viman Nagar, Pune",
            "sites": [
                {"name": "VTP Sierra Luxury Enclave", "address": "Near Balewadi High Street, Pune", "contact": "Amit Shinde", "phone": "+91 98231 55667", "access": "Clear dual-lane access"},
                {"name": "VTP Pegasus Township", "address": "Kharadi Bypass, Pune", "contact": "Ramesh Roy", "phone": "+91 98231 55668", "access": "Boom pump setup on south deck"}
            ]
        },
        {
            "name": "Kolte-Patil Developers Ltd", "contact": "Vikas Agarwal", "phone": "+91 98240 66778", "email": "vikas.a@koltepatil.com",
            "gstin": "27AAACK6677B1Z8", "credit_days": 60, "credit_limit": 5000000.0, "address": "2nd Floor, City Point, Dhole Patil Road, Pune",
            "sites": [
                {"name": "Life Republic - Sector R12", "address": "Marunji Road, Hinjewadi, Pune", "contact": "Dinesh G", "phone": "+91 98241 77889", "access": "Heavy construction entrance gate 2"},
                {"name": "24K Glamore Commercial", "address": "NIBM Road, Kondhwa, Pune", "contact": "Prashant T", "phone": "+91 98241 77890", "access": "Night pour required due to traffic"}
            ]
        },
        {
            "name": "Rohan Builders & Developers", "contact": "Rohan Bhide", "phone": "+91 98250 88990", "email": "rohan.bhide@rohanbuilders.com",
            "gstin": "27AAACR8899A1Z5", "credit_days": 30, "credit_limit": 2000000.0, "address": "Pradeep Chambers, Bhandarkar Road, Pune",
            "sites": [
                {"name": "Rohan Abhilasha Phase 3", "address": "Wagholi, Pune", "contact": "Karan Joshi", "phone": "+91 98251 99001", "access": "Standard TM access"},
                {"name": "Rohan Tarang", "address": "Wakad, Pune", "contact": "Abhay Rao", "phone": "+91 98251 99002", "access": "Steep ramp down to basement"}
            ]
        },
        {
            "name": "B. G. Shirke Construction Tech", "contact": "Ganesh More", "phone": "+91 98260 12345", "email": "ganesh.m@bgshirke.com",
            "gstin": "27AAACB1234E1Z3", "credit_days": 45, "credit_limit": 4000000.0, "address": "72-76 Mundhwa Industrial Area, Pune",
            "sites": [
                {"name": "MHADA Housing Project P3", "address": "Chikhali, PCMC, Pune", "contact": "Santosh B", "phone": "+91 98261 23456", "access": "Wide open site, multiple TMs can stage"},
                {"name": "Flyover Deck Pier 14-22", "address": "Nashik Phata, Pune", "contact": "Subhash S", "phone": "+91 98261 23457", "access": "Traffic police clearance required"}
            ]
        },
        {
            "name": "Nyati Group Enterprises", "contact": "Nitin Nyati", "phone": "+91 98270 98765", "email": "nitin@nyatigroup.com",
            "gstin": "27AAACN9876F1Z2", "credit_days": 15, "credit_limit": 1500000.0, "address": "Nyati Unitree, Nagar Road, Yerwada, Pune",
            "sites": [
                {"name": "Nyati Elysia Highrise", "address": "Kharadi, Pune", "contact": "Gaurav Sen", "phone": "+91 98271 87654", "access": "Static pump with 120m pipeline"},
                {"name": "Nyati Esteban Luxury Villas", "address": "Undri, Pune", "contact": "Sameer Khan", "phone": "+91 98271 87655", "access": "Single lane access inside villa layout"}
            ]
        }
    ]

    customers = []
    for cs in cust_specs:
        c = Customer(
            name=cs["name"],
            contact_person=cs["contact"],
            phone=cs["phone"],
            email=cs["email"],
            gstin=cs["gstin"],
            address=cs["address"],
            credit_days=cs["credit_days"],
            credit_limit=cs["credit_limit"]
        )
        db.session.add(c)
        db.session.flush()
        customers.append(c)

        for s_data in cs["sites"]:
            site = Site(
                customer_id=c.id,
                name=s_data["name"],
                address=s_data["address"],
                contact_person=s_data["contact"],
                phone=s_data["phone"],
                accessibility_notes=s_data["access"]
            )
            db.session.add(site)

    # 5. DRIVERS (10 drivers)
    drivers_data = [
        {"name": "Pandurang Jadhav", "phone": "+91 91580 11001", "lic": "MH-12-2015-001234"},
        {"name": "Dattatray Shinde", "phone": "+91 91580 11002", "lic": "MH-12-2016-002345"},
        {"name": "Gopal Gaikwad", "phone": "+91 91580 11003", "lic": "MH-14-2017-003456"},
        {"name": "Anil Wagh", "phone": "+91 91580 11004", "lic": "MH-12-2018-004567"},
        {"name": "Santosh Chavan", "phone": "+91 91580 11005", "lic": "MH-14-2019-005678"},
        {"name": "Sunil More", "phone": "+91 91580 11006", "lic": "MH-12-2020-006789"},
        {"name": "Vijay Thorat", "phone": "+91 91580 11007", "lic": "MH-12-2021-007890"},
        {"name": "Balasaheb Kadam", "phone": "+91 91580 11008", "lic": "MH-14-2021-008901"},
        {"name": "Pravin Salunke", "phone": "+91 91580 11009", "lic": "MH-12-2022-009012"},
        {"name": "Sambhaji Pawar", "phone": "+91 91580 11010", "lic": "MH-14-2023-010123"}
    ]
    drivers = []
    for d_item in drivers_data:
        d = Driver(
            name=d_item["name"],
            phone=d_item["phone"],
            license_no=d_item["lic"],
            status="AVAILABLE"
        )
        db.session.add(d)
        drivers.append(d)
    db.session.flush()

    # 6. TRUCKS (12 TMs across capacities 5, 7, 8, 9, 10 cum, 2 in maintenance)
    trucks_data = [
        {"tm": "MH-12-RN-1001", "cap": 5, "driver": drivers[0], "status": "AVAILABLE"},
        {"tm": "MH-12-RN-1002", "cap": 5, "driver": drivers[1], "status": "AVAILABLE"},
        {"tm": "MH-12-RN-1003", "cap": 7, "driver": drivers[2], "status": "AVAILABLE"},
        {"tm": "MH-12-RN-1004", "cap": 7, "driver": drivers[3], "status": "AVAILABLE"},
        {"tm": "MH-12-RN-1005", "cap": 8, "driver": drivers[4], "status": "AVAILABLE"},
        {"tm": "MH-12-RN-1006", "cap": 8, "driver": drivers[5], "status": "AVAILABLE"},
        {"tm": "MH-12-RN-1007", "cap": 8, "driver": drivers[6], "status": "AVAILABLE"},
        {"tm": "MH-12-RN-1008", "cap": 9, "driver": drivers[7], "status": "AVAILABLE"},
        {"tm": "MH-12-RN-1009", "cap": 9, "driver": drivers[8], "status": "AVAILABLE"},
        {"tm": "MH-12-RN-1010", "cap": 10, "driver": drivers[9], "status": "AVAILABLE"},
        {"tm": "MH-12-RN-1011", "cap": 10, "driver": None, "status": "MAINTENANCE"},
        {"tm": "MH-12-RN-1012", "cap": 7, "driver": None, "status": "MAINTENANCE"},
    ]
    trucks = []
    for t_item in trucks_data:
        tr = Truck(
            tm_number=t_item["tm"],
            capacity_cum=t_item["cap"],
            status=t_item["status"],
            default_driver_id=t_item["driver"].id if t_item["driver"] else None
        )
        db.session.add(tr)
        trucks.append(tr)
    db.session.flush()

    # 7. USERS (Password Demo@123 for all)
    demo_users = [
        {"name": "Vikramaditya Singhania", "email": "owner@rmc.test", "role": "owner", "mgr": False, "cust": None},
        {"name": "Ananya Sharma", "email": "sales@rmc.test", "role": "sales", "mgr": False, "cust": None},
        {"name": "Devendra Kulkarni", "email": "salesmanager@rmc.test", "role": "sales", "mgr": True, "cust": None},
        {"name": "Mahesh Deshpande", "email": "dispatcher@rmc.test", "role": "dispatcher", "mgr": False, "cust": None},
        {"name": "Siddharth Joshi", "email": "production@rmc.test", "role": "production", "mgr": False, "cust": None},
        {"name": "Dr. Pradeep Sawant", "email": "qa@rmc.test", "role": "qa", "mgr": False, "cust": None},
        {"name": "Rajesh Gupta", "email": "store@rmc.test", "role": "store", "mgr": False, "cust": None},
        {"name": "Priya Nair", "email": "account@rmc.test", "role": "account", "mgr": False, "cust": None},
        {"name": "Rajiv Deshmukh (Customer)", "email": "customer1@rmc.test", "role": "customer", "mgr": False, "cust": customers[0]},
        {"name": "Sanjay Chordiya (Customer)", "email": "customer2@rmc.test", "role": "customer", "mgr": False, "cust": customers[1]},
    ]
    users_by_email = {}
    for u_item in demo_users:
        u = User(
            name=u_item["name"],
            email=u_item["email"],
            phone="+91 98000 12345",
            role=u_item["role"],
            is_manager=u_item["mgr"],
            customer_id=u_item["cust"].id if u_item["cust"] else None,
            is_active=True
        )
        u.set_password("Demo@123")
        db.session.add(u)
        users_by_email[u_item["email"]] = u
    db.session.flush()

    mgr_user = users_by_email["salesmanager@rmc.test"]
    disp_user = users_by_email["dispatcher@rmc.test"]
    qa_user = users_by_email["qa@rmc.test"]

    # 8. SEED 30 DAYS OF HISTORICAL WORKFLOW DATA (POs, Trips, Batches, QC, Invoices, Cubes)
    click.echo("Generating 30 days of realistic history...")

    po_counter = 1
    trip_counter = 1
    batch_counter = 1
    challan_counter = 1
    inv_counter = 1

    # Loop past 30 days
    for day_offset in range(30, 0, -3):
        order_date = now - timedelta(days=day_offset)
        cust = customers[day_offset % len(customers)]
        site = cust.sites[day_offset % len(cust.sites)]
        grade_code = ["M20", "M25", "M30", "M35"][day_offset % 4]
        grade = grades[grade_code]

        po_num = f"PO-2026-{po_counter:04d}"
        po_counter += 1

        po = PurchaseOrder(
            po_number=po_num,
            customer_id=cust.id,
            site_id=site.id,
            grade_id=grade.id,
            quantity_cum=24.0,
            rate_per_cum=grade.default_rate,
            delivery_datetime=order_date,
            purpose="Slab",
            pump_required=True,
            pump_ownership="Company Pump",
            pump_type="Horizontal",
            pipeline_length=90,
            workers_required=4,
            payment_terms_days=cust.credit_days,
            ubitech_ref=f"UBI-{po_num}",
            status="COMPLETED",
            approved_by=mgr_user.id,
            approved_at=order_date - timedelta(hours=6),
            submitted_at=order_date - timedelta(hours=8),
            created_at=order_date - timedelta(days=1),
            created_by=users_by_email["sales@rmc.test"].id
        )
        db.session.add(po)
        db.session.flush()

        # Create 3 delivered trips (8 + 8 + 8 cum)
        delivered_trips = []
        for trip_seq in range(1, 4):
            t_num = f"TRIP-2026-{trip_counter:04d}"
            trip_counter += 1
            truck_assigned = trucks[(trip_counter + trip_seq) % 8]  # pick available
            driver_assigned = drivers[(trip_counter + trip_seq) % 8]

            trip_dt = order_date + timedelta(hours=trip_seq * 2)

            trip = Trip(
                trip_number=t_num,
                po_id=po.id,
                truck_id=truck_assigned.id,
                driver_id=driver_assigned.id,
                sequence=trip_seq,
                quantity_cum=8.0,
                planned_datetime=trip_dt,
                status="DELIVERED",
                dispatched_at=trip_dt + timedelta(minutes=15),
                delivered_at=trip_dt + timedelta(hours=1, minutes=30),
                delivered_quantity=8.0,
                receiver_name="Site Eng. Sachin",
                created_at=trip_dt - timedelta(hours=2),
                created_by=disp_user.id
            )
            db.session.add(trip)
            db.session.flush()
            delivered_trips.append(trip)

            # Batch sheet
            b_num = f"BS-2026-{batch_counter:04d}"
            batch_counter += 1
            mix = grade.mix_design
            batch = BatchSheet(
                batch_number=b_num,
                trip_id=trip.id,
                grade_id=grade.id,
                quantity_cum=8.0,
                cement_kg=mix.cement_kg * 8.0 + 12.0,
                sand_kg=mix.sand_kg * 8.0 - 8.0,
                agg_10_kg=mix.aggregate_10mm_kg * 8.0 + 5.0,
                agg_20_kg=mix.aggregate_20mm_kg * 8.0 - 4.0,
                water_l=mix.water_l * 8.0 + 2.0,
                admixture_l=round(mix.admixture_l * 8.0 + 0.1, 2),
                batched_at=trip_dt,
                qc_status="APPROVED",
                qc_signed_by="Dr. Pradeep Sawant",
                qc_signed_at=trip_dt + timedelta(minutes=10),
                created_at=trip_dt
            )
            db.session.add(batch)
            db.session.flush()

            # QC check
            qc = QcCheck(
                trip_id=trip.id,
                batch_sheet_id=batch.id,
                physical_inspection_ok=True,
                slump_mm=135,
                bleeding_ok=True,
                wrong_mix_ok=True,
                decision="APPROVE",
                remarks="Mix texture and slump optimal.",
                checked_by="Dr. Pradeep Sawant",
                checked_at=trip_dt + timedelta(minutes=8),
                created_at=trip_dt
            )
            db.session.add(qc)

            # Challan
            ch_num = f"CH-2026-{challan_counter:04d}"
            challan_counter += 1
            challan = Challan(
                challan_number=ch_num,
                trip_id=trip.id,
                issued_at=trip_dt + timedelta(minutes=14),
                printed_copies=3,
                released_by="Dispatcher Desk",
                created_at=trip_dt + timedelta(minutes=14),
                created_by=disp_user.id
            )
            db.session.add(challan)

            # Cast cubes on trip 1 of each day
            if trip_seq == 1:
                cube_set = CubeSet(
                    batch_sheet_id=batch.id,
                    trip_id=trip.id,
                    cast_date=order_date.date(),
                    cube_count=6,
                    created_at=order_date
                )
                db.session.add(cube_set)
                db.session.flush()

                # Generate 3d, 7d, 28d tests
                for age, pct in [(3, 0.45), (7, 0.70), (28, 1.05)]:
                    due_d = order_date.date() + timedelta(days=age)
                    is_past = due_d <= today
                    strength = round(grade.characteristic_strength_mpa * pct + 1.2, 1) if is_past else None
                    res = "PASS" if is_past else "PENDING"
                    test = CubeTest(
                        cube_set_id=cube_set.id,
                        age_days=age,
                        due_date=due_d,
                        tested_on=due_d if is_past else None,
                        strength_mpa=strength,
                        result=res,
                        tested_by="Dr. Pradeep Sawant" if is_past else None,
                        created_at=order_date
                    )
                    db.session.add(test)

        # Invoices and payments for completed orders
        inv_num = f"INV-2026-{inv_counter:04d}"
        inv_counter += 1
        subtotal = round(24.0 * po.rate_per_cum, 2)
        total = round(subtotal * 1.18, 2)
        inv_date = order_date.date() + timedelta(days=1)
        due_d = inv_date + timedelta(days=cust.credit_days)

        # Decide paid status
        is_paid = (day_offset > 14)
        is_partial = (day_offset in [7, 8, 9, 10, 11])
        status = "PAID" if is_paid else ("PARTIALLY_PAID" if is_partial else "ISSUED")

        inv = Invoice(
            invoice_number=inv_num,
            po_id=po.id,
            customer_id=cust.id,
            issue_date=inv_date,
            due_date=due_d,
            subtotal=subtotal,
            gst_percent=18.0,
            total=total,
            status=status,
            created_at=datetime.combine(inv_date, datetime.min.time()).replace(tzinfo=timezone.utc),
            created_by=disp_user.id
        )
        db.session.add(inv)
        db.session.flush()

        for d_trip in delivered_trips:
            line = InvoiceLine(
                invoice_id=inv.id,
                trip_id=d_trip.id,
                quantity=8.0,
                rate=po.rate_per_cum,
                amount=round(8.0 * po.rate_per_cum, 2)
            )
            db.session.add(line)

        if is_paid:
            pay = Payment(
                invoice_id=inv.id,
                amount=total,
                paid_on=due_d - timedelta(days=2),
                mode="NEFT",
                reference=f"NEFT/PUNB/{inv_num[-4:]}987",
                recorded_by="Accounts Dept"
            )
            db.session.add(pay)
        elif is_partial:
            pay = Payment(
                invoice_id=inv.id,
                amount=round(total * 0.5, 2),
                paid_on=inv_date + timedelta(days=5),
                mode="RTGS",
                reference=f"RTGS/HDFC/{inv_num[-4:]}123",
                recorded_by="Accounts Dept"
            )
            db.session.add(pay)

    # 9. SEED ACTIVE IN-FLIGHT ORDERS FOR ACCEPTANCE TEST DEMO & DASHBOARD
    # One PO in DRAFT
    po_draft = PurchaseOrder(
        po_number=f"PO-2026-{po_counter:04d}",
        customer_id=customers[2].id,
        site_id=customers[2].sites[0].id,
        grade_id=grades["M25"].id,
        quantity_cum=16.0,
        rate_per_cum=4500.0,
        delivery_datetime=now + timedelta(days=2),
        purpose="Beam",
        pump_required=True,
        payment_terms_days=60,
        status="DRAFT",
        created_at=now - timedelta(hours=2),
        created_by=users_by_email["sales@rmc.test"].id
    )
    po_counter += 1
    db.session.add(po_draft)

    # One PO in SUBMITTED (awaiting Sales Manager approval)
    po_submitted = PurchaseOrder(
        po_number=f"PO-2026-{po_counter:04d}",
        customer_id=customers[3].id,
        site_id=customers[3].sites[0].id,
        grade_id=grades["M30"].id,
        quantity_cum=32.0,
        rate_per_cum=4850.0,
        delivery_datetime=now + timedelta(days=1),
        purpose="Column",
        pump_required=True,
        payment_terms_days=30,
        status="SUBMITTED",
        submitted_at=now - timedelta(hours=1),
        created_at=now - timedelta(hours=3),
        created_by=users_by_email["sales@rmc.test"].id
    )
    po_counter += 1
    db.session.add(po_submitted)

    # One PO in APPROVED (ready for Dispatcher planning)
    po_approved = PurchaseOrder(
        po_number=f"PO-2026-{po_counter:04d}",
        customer_id=customers[0].id,
        site_id=customers[0].sites[0].id,
        grade_id=grades["M25"].id,
        quantity_cum=24.0,
        rate_per_cum=4500.0,
        delivery_datetime=now + timedelta(hours=4),
        purpose="Slab",
        pump_required=True,
        pump_ownership="Company Pump",
        pump_type="Horizontal",
        pipeline_length=90,
        workers_required=4,
        payment_terms_days=45,
        ubitech_ref="UBI-PO-2026-DEMO",
        status="APPROVED",
        approved_by=mgr_user.id,
        approved_at=now - timedelta(minutes=30),
        submitted_at=now - timedelta(hours=1),
        created_at=now - timedelta(hours=2),
        created_by=users_by_email["sales@rmc.test"].id
    )
    po_counter += 1
    db.session.add(po_approved)

    # Material tests
    mat_tests = [
        {"mat": "Cement (OPC 53)", "test": "Fineness by Sieve Analysis", "res": "PASS (4.2% < 10% limit)", "date": today - timedelta(days=3)},
        {"mat": "Cement (OPC 53)", "test": "Standard Consistency & Setting Time", "res": "PASS (Initial 55 min, Final 240 min)", "date": today - timedelta(days=7)},
        {"mat": "River Sand (Zone II)", "test": "Silt Content Test", "res": "PASS (2.8% < 3% limit)", "date": today - timedelta(days=2)},
        {"mat": "Aggregate 20mm", "test": "Impact Value & Crushing Strength", "res": "PASS (Impact 18.5% < 30%)", "date": today - timedelta(days=5)},
        {"mat": "Admixture (PCE)", "test": "Specific Gravity & pH", "res": "PASS (SG 1.08, pH 6.8)", "date": today - timedelta(days=1)}
    ]
    for mt in mat_tests:
        db.session.add(MaterialTest(
            material=mt["mat"],
            test_name=mt["test"],
            result=mt["res"],
            tested_on=mt["date"],
            tested_by="Dr. Pradeep Sawant",
            created_at=now
        ))

    # Initialize Sequences for clean auto-numbering
    year = now.year
    db.session.add(Sequence(name="PO", year=year, last_value=po_counter))
    db.session.add(Sequence(name="TRIP", year=year, last_value=trip_counter))
    db.session.add(Sequence(name="BATCH", year=year, last_value=batch_counter))
    db.session.add(Sequence(name="CHALLAN", year=year, last_value=challan_counter))
    db.session.add(Sequence(name="INVOICE", year=year, last_value=inv_counter))

    # 9. SEED STORE & WEIGHBRIDGE DATA
    click.echo("Seeding Store, Weighbridge, DPR, Calibration and Expenses...")
    
    # Weighbridge settings
    db.session.add(WeighbridgeSettings(
        plant_name="Sai ReadyMix Concrete - Hinjewadi",
        vendor_software_name="Sai Weigh Pro v4.2",
        vendor_company_name="Sai Scales & Automation Pvt Ltd",
        customer_care="+91 20 6789 0100",
        wb_name="WB-01 (Inward/Outward Pitless 60T)",
        com_port="COM3 / 9600-8-N-1",
        auto_capture=True
    ))

    # Weighbridge tickets (10 realistic tickets)
    wb_tickets_data = [
        {"num": "WB-2026-00089", "type": "INWARD", "veh": "MH 12 QX 9821", "mat": "River Sand (Zone II)", "party": "Nira Sands & Minerals", "gross": 34850, "tare": 12150, "net": 22700, "status": "COMPLETED", "driver": "Ramdas Kadam", "challan": 22500, "gate_pass": "GP-4421"},
        {"num": "WB-2026-00090", "type": "INWARD", "veh": "MH 14 BN 4410", "mat": "Cement (OPC 53)", "party": "UltraTech Bulk Terminal", "gross": 42200, "tare": 14100, "net": 28100, "status": "COMPLETED", "driver": "Anil Jadhav", "challan": 28000, "gate_pass": "GP-4422"},
        {"num": "WB-2026-00091", "type": "INWARD", "veh": "MH 12 KP 3302", "mat": "Aggregate 20mm", "party": "Vetal Hill Stone Crushers", "gross": 36100, "tare": 11900, "net": 24200, "status": "COMPLETED", "driver": "Santosh Gaikwad", "challan": 24000, "gate_pass": "GP-4423"},
        {"num": "WB-2026-00092", "type": "INWARD", "veh": "MH 14 EM 8841", "mat": "Aggregate 10mm", "party": "Vetal Hill Stone Crushers", "gross": 33400, "tare": 11800, "net": 21600, "status": "COMPLETED", "driver": "Dnyaneshwar Gore", "challan": 21500, "gate_pass": "GP-4424"},
        {"num": "WB-2026-00093", "type": "INWARD", "veh": "MH 12 AB 6712", "mat": "Fly Ash (Class F)", "party": "Dirk India / Pozzocrete", "gross": 38900, "tare": 13400, "net": 25500, "status": "COMPLETED", "driver": "Suresh More", "challan": 25000, "gate_pass": "GP-4425"},
        {"num": "WB-2026-00094", "type": "INWARD", "veh": "MH 14 RQ 1290", "mat": "GGBS (Slag)", "party": "JSW Cement Ltd", "gross": 39500, "tare": 13600, "net": 25900, "status": "COMPLETED", "driver": "Pravin Salunke", "challan": 25500, "gate_pass": "GP-4426"},
        {"num": "WB-2026-00095", "type": "INWARD", "veh": "MH 12 RN 5510", "mat": "River Sand (Zone II)", "party": "Bhima River Aggregate Co", "gross": 35200, "tare": 12000, "net": 23200, "status": "COMPLETED", "driver": "Gopal Shinde", "challan": 23000, "gate_pass": "GP-4427"},
        {"num": "WB-2026-00096", "type": "INWARD", "veh": "MH 14 TR 7840", "mat": "Cement (OPC 53)", "party": "Ambuja Cements Ltd", "gross": 41800, "tare": 13900, "net": 27900, "status": "COMPLETED", "driver": "Mahesh Pawar", "challan": 28000, "gate_pass": "GP-4428"},
        {"num": "WB-2026-00097", "type": "INWARD", "veh": "MH 12 PQ 2011", "mat": "Aggregate 20mm", "party": "Sahyadri Mines & Minerals", "gross": 35800, "tare": 11950, "net": 23850, "status": "COMPLETED", "driver": "Sunil Thorat", "challan": 23800, "gate_pass": "GP-4429"},
        {"num": "WB-2026-00098", "type": "INWARD", "veh": "MH 12 XY 4401", "mat": "Admixture (PCE)", "party": "Fosroc Chemicals India", "gross": 18200, "tare": 14200, "net": 4000, "status": "COMPLETED", "driver": "Kailash Patil", "challan": 4000, "gate_pass": "GP-4430"},
    ]
    for idx, t_d in enumerate(wb_tickets_data):
        ticket_dt = (now - timedelta(days=idx % 5, hours=idx * 2)).strftime("%Y-%m-%d %H:%M:%S")
        db.session.add(WeighbridgeTicket(
            ticket_number=t_d["num"],
            type=t_d["type"],
            vehicle_number=t_d["veh"],
            material=t_d["mat"],
            supplier_or_customer=t_d["party"],
            gross_weight=t_d["gross"],
            tare_weight=t_d["tare"],
            net_weight=t_d["net"],
            gross_time=ticket_dt,
            tare_time=ticket_dt,
            status=t_d["status"],
            variance=t_d["net"] - t_d["challan"],
            challan_weight=t_d["challan"],
            received_rs=0.0,
            wb_name="Weighbridge #1",
            driver_name=t_d["driver"],
            watchman_name="Ganesh K",
            gate_pass_no=t_d["gate_pass"]
        ))

    # All 18 Transit Mixer Payloads (matching Sai ReadyMix sheet)
    tm_payloads_data = [
        {"sNo": 7, "vehicleNo": "MH 14 GU 3506", "vehicleType": "TM", "make": "Ashok Leyland", "location": "Mulkhed", "vehicleTyreDetails": "10 Tyres", "overLoadPass": "No", "installedHandiCapacityCum": 6, "rtoGvwKg": 28000, "tareWeightKg": 11600, "weightOfWaterKg": 500, "newTareWeightKg": 12100, "actualWeightForLoadingKg": 15900, "payLoadCapacityRcGvwCum": 6, "supplyPayLoadCapacityOverloadPassCum": 6},
        {"sNo": 8, "vehicleNo": "MH 14 GU 3507", "vehicleType": "TM", "make": "Ashok Leyland", "location": "Mulkhed", "vehicleTyreDetails": "10 Tyres", "overLoadPass": "No", "installedHandiCapacityCum": 6, "rtoGvwKg": 28000, "tareWeightKg": 11600, "weightOfWaterKg": 500, "newTareWeightKg": 12100, "actualWeightForLoadingKg": 15900, "payLoadCapacityRcGvwCum": 6, "supplyPayLoadCapacityOverloadPassCum": 6},
        {"sNo": 9, "vehicleNo": "MH 14 HG 3501", "vehicleType": "TM", "make": "Benz", "location": "Mulkhed", "vehicleTyreDetails": "10 Tyres", "overLoadPass": "Yes", "installedHandiCapacityCum": 8, "rtoGvwKg": 28000, "tareWeightKg": 12400, "weightOfWaterKg": 500, "newTareWeightKg": 12900, "actualWeightForLoadingKg": 15100, "payLoadCapacityRcGvwCum": 6, "supplyPayLoadCapacityOverloadPassCum": 8},
        {"sNo": 10, "vehicleNo": "MH 14 HG 3502", "vehicleType": "TM", "make": "Benz", "location": "Mulkhed", "vehicleTyreDetails": "10 Tyres", "overLoadPass": "Yes", "installedHandiCapacityCum": 8, "rtoGvwKg": 28000, "tareWeightKg": 12400, "weightOfWaterKg": 500, "newTareWeightKg": 12900, "actualWeightForLoadingKg": 15100, "payLoadCapacityRcGvwCum": 6, "supplyPayLoadCapacityOverloadPassCum": 8},
        {"sNo": 11, "vehicleNo": "MH 14 HG 3503", "vehicleType": "TM", "make": "Benz", "location": "Mulkhed", "vehicleTyreDetails": "10 Tyres", "overLoadPass": "Yes", "installedHandiCapacityCum": 8, "rtoGvwKg": 28000, "tareWeightKg": 12400, "weightOfWaterKg": 500, "newTareWeightKg": 12900, "actualWeightForLoadingKg": 15100, "payLoadCapacityRcGvwCum": 6, "supplyPayLoadCapacityOverloadPassCum": 8},
        {"sNo": 12, "vehicleNo": "MH 14 HG 3504", "vehicleType": "TM", "make": "Benz", "location": "Mulkhed", "vehicleTyreDetails": "10 Tyres", "overLoadPass": "Yes", "installedHandiCapacityCum": 8, "rtoGvwKg": 28000, "tareWeightKg": 12400, "weightOfWaterKg": 500, "newTareWeightKg": 12900, "actualWeightForLoadingKg": 15100, "payLoadCapacityRcGvwCum": 6, "supplyPayLoadCapacityOverloadPassCum": 8},
        {"sNo": 13, "vehicleNo": "MH 14 KA 3514", "vehicleType": "TM", "make": "Benz", "location": "Mulkhed", "vehicleTyreDetails": "10 Tyres", "overLoadPass": "Yes", "installedHandiCapacityCum": 8, "rtoGvwKg": 28000, "tareWeightKg": 12400, "weightOfWaterKg": 500, "newTareWeightKg": 12900, "actualWeightForLoadingKg": 15100, "payLoadCapacityRcGvwCum": 6, "supplyPayLoadCapacityOverloadPassCum": 8},
        {"sNo": 14, "vehicleNo": "MH 14 KA 3515", "vehicleType": "TM", "make": "Benz", "location": "Mulkhed", "vehicleTyreDetails": "10 Tyres", "overLoadPass": "Yes", "installedHandiCapacityCum": 8, "rtoGvwKg": 28000, "tareWeightKg": 12400, "weightOfWaterKg": 500, "newTareWeightKg": 12900, "actualWeightForLoadingKg": 15100, "payLoadCapacityRcGvwCum": 6, "supplyPayLoadCapacityOverloadPassCum": 8},
        {"sNo": 15, "vehicleNo": "MH 14 KA 3516", "vehicleType": "TM", "make": "Benz", "location": "Mulkhed", "vehicleTyreDetails": "10 Tyres", "overLoadPass": "Yes", "installedHandiCapacityCum": 8, "rtoGvwKg": 28000, "tareWeightKg": 12400, "weightOfWaterKg": 500, "newTareWeightKg": 12900, "actualWeightForLoadingKg": 15100, "payLoadCapacityRcGvwCum": 6, "supplyPayLoadCapacityOverloadPassCum": 8},
        {"sNo": 16, "vehicleNo": "MH 14 LB 3529", "vehicleType": "TM", "make": "TATA", "location": "Mulkhed", "vehicleTyreDetails": "10 Tyres", "overLoadPass": "Yes", "installedHandiCapacityCum": 7, "rtoGvwKg": 28000, "tareWeightKg": 12000, "weightOfWaterKg": 500, "newTareWeightKg": 12500, "actualWeightForLoadingKg": 15500, "payLoadCapacityRcGvwCum": 6, "supplyPayLoadCapacityOverloadPassCum": 7},
        {"sNo": 17, "vehicleNo": "MH 14 LB 3530", "vehicleType": "TM", "make": "TATA", "location": "Mulkhed", "vehicleTyreDetails": "10 Tyres", "overLoadPass": "Yes", "installedHandiCapacityCum": 7, "rtoGvwKg": 28000, "tareWeightKg": 12000, "weightOfWaterKg": 500, "newTareWeightKg": 12500, "actualWeightForLoadingKg": 15500, "payLoadCapacityRcGvwCum": 6, "supplyPayLoadCapacityOverloadPassCum": 7},
        {"sNo": 18, "vehicleNo": "MH 14 LB 3531", "vehicleType": "TM", "make": "TATA", "location": "Mulkhed", "vehicleTyreDetails": "10 Tyres", "overLoadPass": "Yes", "installedHandiCapacityCum": 7, "rtoGvwKg": 28000, "tareWeightKg": 12000, "weightOfWaterKg": 500, "newTareWeightKg": 12500, "actualWeightForLoadingKg": 15500, "payLoadCapacityRcGvwCum": 6, "supplyPayLoadCapacityOverloadPassCum": 7},
        {"sNo": 19, "vehicleNo": "MH 14 LB 3532", "vehicleType": "TM", "make": "TATA", "location": "Mulkhed", "vehicleTyreDetails": "10 Tyres", "overLoadPass": "Yes", "installedHandiCapacityCum": 7, "rtoGvwKg": 28000, "tareWeightKg": 12000, "weightOfWaterKg": 500, "newTareWeightKg": 12500, "actualWeightForLoadingKg": 15500, "payLoadCapacityRcGvwCum": 6, "supplyPayLoadCapacityOverloadPassCum": 7},
        {"sNo": 20, "vehicleNo": "MH 14 LB 3533", "vehicleType": "TM", "make": "TATA", "location": "Mulkhed", "vehicleTyreDetails": "10 Tyres", "overLoadPass": "Yes", "installedHandiCapacityCum": 7, "rtoGvwKg": 28000, "tareWeightKg": 12000, "weightOfWaterKg": 500, "newTareWeightKg": 12500, "actualWeightForLoadingKg": 15500, "payLoadCapacityRcGvwCum": 6, "supplyPayLoadCapacityOverloadPassCum": 7},
        {"sNo": 21, "vehicleNo": "MH 14 MH 3536", "vehicleType": "TM", "make": "TATA", "location": "Mhalunge", "vehicleTyreDetails": "12 Tyres", "overLoadPass": "Yes", "installedHandiCapacityCum": 9, "rtoGvwKg": 35000, "tareWeightKg": 13900, "weightOfWaterKg": 500, "newTareWeightKg": 14400, "actualWeightForLoadingKg": 20600, "payLoadCapacityRcGvwCum": 8, "supplyPayLoadCapacityOverloadPassCum": 9},
        {"sNo": 22, "vehicleNo": "MH 14 MH 3537", "vehicleType": "TM", "make": "TATA", "location": "Mhalunge", "vehicleTyreDetails": "12 Tyres", "overLoadPass": "Yes", "installedHandiCapacityCum": 9, "rtoGvwKg": 35000, "tareWeightKg": 13900, "weightOfWaterKg": 500, "newTareWeightKg": 14400, "actualWeightForLoadingKg": 20600, "payLoadCapacityRcGvwCum": 8, "supplyPayLoadCapacityOverloadPassCum": 9},
        {"sNo": 23, "vehicleNo": "MH 14 MH 3538", "vehicleType": "TM", "make": "TATA", "location": "Mhalunge", "vehicleTyreDetails": "12 Tyres", "overLoadPass": "Yes", "installedHandiCapacityCum": 9, "rtoGvwKg": 35000, "tareWeightKg": 13900, "weightOfWaterKg": 500, "newTareWeightKg": 14400, "actualWeightForLoadingKg": 20600, "payLoadCapacityRcGvwCum": 8, "supplyPayLoadCapacityOverloadPassCum": 9},
        {"sNo": 24, "vehicleNo": "MH 14 MH 3539", "vehicleType": "TM", "make": "TATA", "location": "Mhalunge", "vehicleTyreDetails": "12 Tyres", "overLoadPass": "Yes", "installedHandiCapacityCum": 9, "rtoGvwKg": 35000, "tareWeightKg": 13900, "weightOfWaterKg": 500, "newTareWeightKg": 14400, "actualWeightForLoadingKg": 20600, "payLoadCapacityRcGvwCum": 8, "supplyPayLoadCapacityOverloadPassCum": 9},
    ]
    for p_d in tm_payloads_data:
        db.session.add(TransitMixerPayload(
            s_no=p_d["sNo"],
            vehicle_no=p_d["vehicleNo"],
            vehicle_type=p_d["vehicleType"],
            make=p_d["make"],
            location=p_d["location"],
            vehicle_tyre_details=p_d["vehicleTyreDetails"],
            overload_pass=p_d["overLoadPass"],
            installed_handi_capacity_cum=p_d["installedHandiCapacityCum"],
            rto_gvw_kg=p_d["rtoGvwKg"],
            tare_weight_kg=p_d["tareWeightKg"],
            weight_of_water_kg=p_d["weightOfWaterKg"],
            new_tare_weight_kg=p_d["newTareWeightKg"],
            actual_weight_for_loading_kg=p_d["actualWeightForLoadingKg"],
            payload_capacity_rc_gvw_cum=p_d["payLoadCapacityRcGvwCum"],
            supply_payload_capacity_overload_pass_cum=p_d["supplyPayLoadCapacityOverloadPassCum"]
        ))

    # DPR Records (past 5 days)
    for i in range(5):
        d_day = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        db.session.add(DprRecord(
            date=d_day,
            total_batches=42 - (i * 3),
            total_cum=278.0 - (i * 18),
            cement_consumed_mt=88.5 - (i * 5),
            fly_ash_consumed_mt=24.2 - (i * 1.5),
            ggbs_consumed_mt=18.6 - (i * 1.2),
            sand_consumed_mt=195.0 - (i * 12),
            aggregate_consumed_mt=320.0 - (i * 20),
            water_consumed_kl=48.0 - (i * 3),
            admixture_consumed_kg=1250 - (i * 80),
            diesel_consumed_ltr=450 - (i * 25)
        ))

    # Expenses (past 6 bills)
    expenses_data = [
        {"cat": "Diesel", "vendor": "Indian Oil Corporation Bulk Fuel", "bill": "IOC-7721", "days_ago": 0, "amt": 142000, "status": "PAID", "desc": "1500 Liters High Speed Diesel for Batching Plant & Genset"},
        {"cat": "Cement / Materials", "vendor": "UltraTech Cement Ltd", "bill": "UTC-9831", "days_ago": 1, "amt": 385000, "status": "PAID", "desc": "70 MT OPC 53 Grade Bulk Tanker Supply"},
        {"cat": "Aggregate", "vendor": "Vetal Hill Stone Crushers", "bill": "VSC-1149", "days_ago": 2, "amt": 188000, "status": "PAID", "desc": "120 MT 10mm & 20mm Blue Metal Aggregates"},
        {"cat": "Fly Ash / GGBS", "vendor": "Dirk India / Pozzocrete", "bill": "DI-5502", "days_ago": 3, "amt": 68000, "status": "PAID", "desc": "35 MT Classified Fly Ash (Class F)"},
        {"cat": "Vehicle Maintenance", "vendor": "Mahalaxmi Auto Spares & Garage", "bill": "MAG-882", "days_ago": 4, "amt": 32000, "status": "PAID", "desc": "TM MH 14 KA 3514 Hydraulic Pump Hose & Drum Rollers Greasing"},
        {"cat": "Land Bills", "vendor": "MSEDCL (Maharashtra State Electricity)", "bill": "MSE-918231", "days_ago": 5, "amt": 88400, "status": "PAID", "desc": "Plant HT Industrial Power Bill"}
    ]
    for ex in expenses_data:
        db.session.add(ExpenseRecord(
            category=ex["cat"],
            vendor=ex["vendor"],
            bill_no=ex["bill"],
            date=(today - timedelta(days=ex["days_ago"])).strftime("%Y-%m-%d"),
            amount=ex["amt"],
            status=ex["status"],
            description=ex["desc"]
        ))

    # Attendance (staff & drivers)
    att_data = [
        {"type": "DRIVER", "name": "Sanjay Shinde", "veh": "TM: MH 14 GU 3506", "shift": "Day", "trips": 4, "status": "PRESENT"},
        {"type": "DRIVER", "name": "Rahul Jadhav", "veh": "TM: MH 14 HG 3501", "shift": "Day", "trips": 5, "status": "ON_TRIP"},
        {"type": "DRIVER", "name": "Kailash Patil", "veh": "TM: MH 14 KA 3514", "shift": "Day", "trips": 3, "status": "ON_TRIP"},
        {"type": "DRIVER", "name": "Amol More", "veh": "TM: MH 14 LB 3529", "shift": "Day", "trips": 4, "status": "PRESENT"},
        {"type": "DRIVER", "name": "Dnyaneshwar Gore", "veh": "TM: MH 14 MH 3536", "shift": "Night", "trips": 0, "status": "PRESENT"},
        {"type": "STAFF", "name": "Rajesh Gupta", "veh": "Storekeeper / Materials Manager", "shift": "Day", "trips": 12, "status": "PRESENT"},
        {"type": "STAFF", "name": "Suresh Chavan", "veh": "Batching Plant Operator", "shift": "Day", "trips": 38, "status": "PRESENT"},
        {"type": "STAFF", "name": "Ganesh Shinde", "veh": "Weighbridge Watchman & Security", "shift": "Day", "trips": 18, "status": "PRESENT"},
        {"type": "STAFF", "name": "Mahesh Kadam", "veh": "Loader Operator (Aggregates)", "shift": "Day", "trips": 22, "status": "PRESENT"}
    ]
    for at in att_data:
        db.session.add(AttendanceRecord(
            type=at["type"],
            name=at["name"],
            designation_or_vehicle=at["veh"],
            shift=at["shift"],
            trips_or_tasks=at["trips"],
            status=at["status"],
            sync_source="UBITECH"
        ))

    # 10. SEED HR & PAYROLL DATA
    click.echo("Seeding HR Employees and Payroll runs...")
    employees_data = [
        {"id": "EMP001", "name": "Vikramaditya Singhania", "dept": "Management", "role": "Owner / Managing Director", "join": "2020-01-15", "status": "ACTIVE", "salary": 180000.0},
        {"id": "EMP002", "name": "Devendra Kulkarni", "dept": "Sales", "role": "Sales Manager", "join": "2021-03-10", "status": "ACTIVE", "salary": 85000.0},
        {"id": "EMP003", "name": "Dr. Pradeep Sawant", "dept": "Quality", "role": "QA / QC Lead Engineer", "join": "2021-06-22", "status": "ACTIVE", "salary": 75000.0},
        {"id": "EMP004", "name": "Siddharth Joshi", "dept": "Production", "role": "Batching Plant Head", "join": "2020-11-05", "status": "ACTIVE", "salary": 65000.0},
        {"id": "EMP005", "name": "Mahesh Deshpande", "dept": "Logistics", "role": "Dispatcher & Fleet Lead", "join": "2022-02-14", "status": "ACTIVE", "salary": 60000.0},
        {"id": "EMP006", "name": "Rajesh Gupta", "dept": "Store", "role": "Store & Weighbridge Manager", "join": "2022-08-01", "status": "ACTIVE", "salary": 50000.0},
        {"id": "EMP007", "name": "Priya Nair", "dept": "Accounts", "role": "HR & Payroll Lead", "join": "2022-09-15", "status": "ACTIVE", "salary": 55000.0},
        {"id": "EMP008", "name": "Ananya Sharma", "dept": "Sales", "role": "Sales Officer", "join": "2023-01-10", "status": "ACTIVE", "salary": 45000.0},
    ]
    for emp in employees_data:
        db.session.add(Employee(
            emp_code=emp["id"],
            name=emp["name"],
            department=emp["dept"],
            role=emp["role"],
            join_date=emp["join"],
            status=emp["status"],
            base_salary=emp["salary"]
        ))

    # Payroll Runs
    prev_month = (today - timedelta(days=30)).strftime("%b %Y")
    curr_month = today.strftime("%b %Y")
    total_payroll = sum(e["salary"] for e in employees_data)
    db.session.add(PayrollRun(
        payroll_code=f"PR_{(today - timedelta(days=30)).strftime('%Y%m')}",
        period=prev_month,
        total_employees=len(employees_data),
        total_amount=total_payroll,
        status="PAID",
        processed_date=now - timedelta(days=25)
    ))
    db.session.add(PayrollRun(
        payroll_code=f"PR_{today.strftime('%Y%m')}",
        period=curr_month,
        total_employees=len(employees_data),
        total_amount=total_payroll,
        status="DRAFT",
        processed_date=None
    ))

    db.session.commit()
    click.echo("Database successfully seeded with realistic RMC data!")
