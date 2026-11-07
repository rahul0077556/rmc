from flask import Blueprint, request
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
from backend.app.models.models import User
from backend.app.utils.responses import success_response, error_response
from backend.app.extensions import db

auth_bp = Blueprint("auth", __name__, url_prefix="/api/v1/auth")

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return error_response(code="INVALID_CREDENTIALS", message="Email and password are required.", status_code=400)

    user = User.query.filter_by(email=email).first()

    if not user or not user.check_password(password):
        return error_response(code="UNAUTHORIZED", message="Invalid email or password.", status_code=401)

    if not user.is_active:
        return error_response(code="INACTIVE_USER", message="User account is deactivated.", status_code=403)

    # JWT additional claims
    effective_role = "sales_manager" if (user.role == "sales" and user.is_manager) else user.role
    from backend.app.models.models import Plant
    plant_name = "ROXXCON RMC NAGPUR"
    if user.plant_id:
        p = Plant.query.get(user.plant_id)
        if p:
            plant_name = p.name
    else:
        if user.email in ["owner@rmc.test", "sales@rmc.test", "salesmanager@rmc.test", "dispatcher@rmc.test", "production@rmc.test", "qa@rmc.test", "store@rmc.test", "account@rmc.test", "supervisor@rmc.test", "customer1@rmc.test"]:
            p = Plant.query.filter_by(name="ROXXCON RMC NAGPUR").first() or Plant.query.first()
            if p:
                plant_name = p.name
                user.plant_id = p.id
                db.session.commit()
        else:
            import uuid
            p = Plant(
                id=str(uuid.uuid4()).replace("-", ""),
                name=f"{user.name} Ready Mix",
                city="India",
                address=f"{user.name} Industrial Facility",
                gstin="27AAAPA" + str(uuid.uuid4())[:4].upper() + "1Z9",
                phone=user.phone or "+91 98765 43210",
                email=user.email,
                capacity="60 cum/hr",
                scada_type="CRB-75"
            )
            db.session.add(p)
            user.plant_id = p.id
            plant_name = p.name
            db.session.commit()

    additional_claims = {
        "role": effective_role,
        "base_role": user.role,
        "is_manager": user.is_manager,
        "customer_id": user.customer_id,
        "name": user.name,
        "email": user.email,
        "plant": plant_name,
        "plant_id": user.plant_id
    }

    token = create_access_token(identity=user.id, additional_claims=additional_claims)
    return success_response(data={
        "token": token,
        "user": user.to_dict()
    })

@auth_bp.route("/organizations", methods=["GET"])
def list_organizations():
    from backend.app.models.models import Plant, User
    plants = Plant.query.order_by(Plant.created_at.asc()).all()
    res = []
    for p in plants:
        user_count = User.query.filter_by(plant_id=p.id, is_active=True).count()
        res.append({
            "id": p.id,
            "name": p.name,
            "city": p.city or "India",
            "capacity": p.capacity or "60 cum/hr",
            "scada": p.scada_type or "CRB-75",
            "userCount": user_count,
            "status": "Active Plant Workspace"
        })
    return success_response(data=res)

@auth_bp.route("/plant-accounts", methods=["GET"])
def get_plant_accounts():
    plant_id = request.args.get("plant_id")
    from backend.app.models.models import Plant
    if not plant_id:
        p = Plant.query.filter_by(name="ROXXCON RMC NAGPUR").first() or Plant.query.first()
        plant_id = p.id if p else None

    if not plant_id:
        return success_response(data=[])

    users = User.query.filter_by(plant_id=plant_id, is_active=True).all()
    role_meta = {
        "owner": {"title": "Plant Owner / Director", "sub": "Executive P&L & Audits", "home": "/owner"},
        "sales": {"title": "Sales Desk", "sub": "Order Booking & POs", "home": "/sales"},
        "sales_manager": {"title": "Sales Manager", "sub": "Commercial Approvals", "home": "/sales"},
        "dispatcher": {"title": "Dispatch Master", "sub": "Fleet & TM Logistics", "home": "/dispatcher"},
        "supervisor": {"title": "Site Supervisor", "sub": "Pouring & Pump Ops", "home": "/supervisor"},
        "production": {"title": "Production Engineer", "sub": "CRB-75 SCADA Batching", "home": "/production"},
        "qa": {"title": "QA / QC Lab In-Charge", "sub": "IS 456 Slump & Cubes", "home": "/qa"},
        "store": {"title": "Store & Weighbridge", "sub": "Gross/Tare & Silo Stock", "home": "/store"},
        "account": {"title": "Accounts & Billing", "sub": "GST Invoicing & Ledger", "home": "/account"},
        "customer": {"title": "Customer Client Portal", "sub": "Live Orders & E-Challans", "home": "/customer"},
    }

    res = []
    for u in users:
        effective_role = "sales_manager" if (u.role == "sales" and u.is_manager) else u.role
        meta = role_meta.get(effective_role, role_meta.get(u.role, {"title": u.name, "sub": u.role, "home": "/queue"}))
        res.append({
            "id": u.id,
            "role": effective_role,
            "base_role": u.role,
            "title": meta["title"],
            "sub": meta["sub"],
            "name": u.name,
            "email": u.email,
            "home": meta["home"]
        })
    return success_response(data=res)

@auth_bp.route("/register-organization", methods=["POST"])
def register_organization():
    data = request.get_json() or {}
    org_name = data.get("organization_name", "").strip() or data.get("plant_name", "").strip()
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    phone = data.get("phone", "").strip()
    city = data.get("city", "").strip()
    capacity = data.get("capacity", "60 cum/hr").strip()
    scada_type = data.get("scada_type", "CRB-75").strip()
    role = data.get("role", "owner").strip().lower()

    if not org_name:
        return error_response(code="VALIDATION_ERROR", message="Organization / Plant name is required.", status_code=400)
    if not name:
        return error_response(code="VALIDATION_ERROR", message="Administrator full name is required.", status_code=400)
    if not email or "@" not in email:
        return error_response(code="VALIDATION_ERROR", message="Valid official business email is required.", status_code=400)
    if not password or len(password) < 6:
        return error_response(code="VALIDATION_ERROR", message="Password must be at least 6 characters.", status_code=400)

    # Check if user already exists
    existing = User.query.filter_by(email=email).first()
    if existing:
        return error_response(code="EMAIL_EXISTS", message="An account with this email already exists. Please sign in.", status_code=400)

    import uuid
    import re
    from datetime import datetime, timezone
    from backend.app.models.models import (
        Plant, Material, WeighbridgeSettings, Customer, Site,
        Truck, Driver, WeighbridgeTicket, StockTransaction
    )

    slug = re.sub(r'[^a-z0-9]', '', org_name.lower())[:10] or "plant"
    new_plant_id = str(uuid.uuid4()).replace("-", "")
    new_plant = Plant(
        id=new_plant_id,
        name=org_name,
        city=city or "Nagpur, India",
        address=f"{city}, India" if city else f"{org_name} Industrial Campus",
        gstin="27AAAPA" + str(uuid.uuid4())[:4].upper() + "1Z9",
        phone=phone or "+91 98765 43210",
        email=email,
        capacity=capacity,
        scada_type=scada_type
    )
    db.session.add(new_plant)

    # 1. Primary Owner User
    new_user = User(
        name=name,
        email=email,
        phone=phone,
        role=role if role in ["owner", "sales", "dispatcher", "production", "qa", "store", "account"] else "owner",
        is_manager=True,
        plant_id=new_plant_id,
        is_active=True
    )
    new_user.set_password(password)
    db.session.add(new_user)

    # 2. Sub-Logins for the other 9 roles with plant slug
    sub_accounts = [
        {"name": f"{org_name} Sales Desk", "role": "sales", "is_mgr": False, "sub": "sales"},
        {"name": f"{org_name} Sales Manager", "role": "sales", "is_mgr": True, "sub": "salesmanager"},
        {"name": f"{org_name} Dispatch Master", "role": "dispatcher", "is_mgr": False, "sub": "dispatcher"},
        {"name": f"{org_name} Site Supervisor", "role": "supervisor", "is_mgr": False, "sub": "supervisor"},
        {"name": f"{org_name} Production Engineer", "role": "production", "is_mgr": False, "sub": "production"},
        {"name": f"{org_name} QA / QC Lab In-Charge", "role": "qa", "is_mgr": False, "sub": "qa"},
        {"name": f"{org_name} Store & Weighbridge", "role": "store", "is_mgr": False, "sub": "store"},
        {"name": f"{org_name} Accounts & Billing", "role": "account", "is_mgr": False, "sub": "account"},
        {"name": f"{org_name} Client Portal User", "role": "customer", "is_mgr": False, "sub": "customer"},
    ]
    for sa in sub_accounts:
        sub_email = f"{sa['sub']}.{slug}@rmc.test"
        if not User.query.filter_by(email=sub_email).first():
            usr = User(
                name=sa["name"],
                email=sub_email,
                phone=phone or "+91 98765 43210",
                role=sa["role"],
                is_manager=sa["is_mgr"],
                plant_id=new_plant_id,
                is_active=True
            )
            usr.set_password("Demo@123")
            db.session.add(usr)

    # 3. Provision 4 Dedicated Enterprise Customers for this plant
    starter_customers = [
        {
            "name": f"{org_name} Infrastructure Project (Metro)",
            "contact": "Er. Rajesh Deshmukh",
            "phone": "+91 98220 11223",
            "email": f"metro.{slug}@client.test",
            "gstin": "27AAACL" + str(uuid.uuid4())[:4].upper() + "1Z8",
            "address": f"Metro Rail Project Zone, {city or 'Maharashtra'}",
            "site": f"Corridor Pier P-102 Site, {city or 'Maharashtra'}",
        },
        {
            "name": f"{org_name} Commercial Township (Tower A)",
            "contact": "Nitin Gadre",
            "phone": "+91 94231 44556",
            "email": f"township.{slug}@client.test",
            "gstin": "27AAACG" + str(uuid.uuid4())[:4].upper() + "1Z3",
            "address": f"Commercial Tech Hub, {city or 'Maharashtra'}",
            "site": f"Tower A Foundation Site, {city or 'Maharashtra'}",
        },
        {
            "name": f"{org_name} Expressway Flyover Package",
            "contact": "Amitabh Verma",
            "phone": "+91 97654 33221",
            "email": f"expressway.{slug}@client.test",
            "gstin": "27AAACT" + str(uuid.uuid4())[:4].upper() + "1Z4",
            "address": f"Expressway Interchange Km 14, {city or 'Maharashtra'}",
            "site": f"Flyover Pier Pier-12 Site, {city or 'Maharashtra'}",
        },
        {
            "name": f"{org_name} Industrial Park Foundation",
            "contact": "Vikas Rathi",
            "phone": "+91 98901 88776",
            "email": f"industrial.{slug}@client.test",
            "gstin": "27AAACK" + str(uuid.uuid4())[:4].upper() + "1Z6",
            "address": f"MIDC Industrial Phase II, {city or 'Maharashtra'}",
            "site": f"Substation Base Bay Site, {city or 'Maharashtra'}",
        },
    ]

    for c_info in starter_customers:
        cust = Customer(
            name=c_info["name"],
            contact_person=c_info["contact"],
            phone=c_info["phone"],
            email=c_info["email"],
            gstin=c_info["gstin"],
            address=c_info["address"],
            credit_days=45,
            credit_limit=5000000.0,
            plant_id=new_plant_id
        )
        db.session.add(cust)
        db.session.flush()

        st = Site(
            customer_id=cust.id,
            name=c_info["site"],
            address=c_info["address"],
            contact_person=c_info["contact"],
            phone=c_info["phone"],
            accessibility_notes="All TM access lanes verified. Water supply available on site."
        )
        db.session.add(st)

    # 4. Provision Inwarded Materials with Stock & Weighbridge Records
    starter_materials = [
        ("Cement (OPC 53)", "kg", 35000.0, 50000.0, 3.15, "UltraTech Bulk Tanker", "MH-40-BL-1122"),
        ("River Sand (Zone II)", "kg", 45000.0, 80000.0, 2.65, "Narmada River Sand", "MH-40-TR-3344"),
        ("Manufactured Sand (M-Sand)", "kg", 45000.0, 50000.0, 2.60, "VSI Sand Quarry", "MH-40-TR-5566"),
        ("Aggregate 10mm", "kg", 50000.0, 60000.0, 2.70, "Crusher Metal 10mm", "MH-40-TR-7788"),
        ("Aggregate 20mm", "kg", 60000.0, 90000.0, 2.70, "Crusher Metal 20mm", "MH-40-TR-9900"),
        ("Fly Ash (Class F)", "kg", 30000.0, 30000.0, 2.20, "Thermal Power Station", "MH-40-BL-2233"),
        ("GGBS (Slag)", "kg", 30000.0, 35000.0, 2.90, "JSW Cement Ltd", "MH-40-BL-4455"),
        ("Water", "l", 50000.0, 50000.0, 1.00, "Industrial Pipeline", "PIPE-01"),
        ("Admixture (PCE)", "l", 1200.0, 800.0, 1.08, "Sika Plastiment", "MH-12-CM-8899"),
        ("Diesel", "l", 6000.0, 2000.0, 0.85, "Indian Oil Bowser", "MH-40-FL-9911"),
    ]

    now_iso = datetime.now(timezone.utc).isoformat()
    for idx, (m_name, unit, stock_qty, reorder, density, supplier, vehicle) in enumerate(starter_materials, 1):
        mat = Material(
            name=m_name,
            unit=unit,
            current_stock=stock_qty,
            reorder_level=reorder,
            density=density,
            is_tracked=True if m_name != "Water" else False,
            is_active=True,
            plant_id=new_plant_id
        )
        db.session.add(mat)
        db.session.flush()

        wb_ticket = WeighbridgeTicket(
            ticket_number=f"WB-INW-{slug.upper()}-{idx:03d}",
            type="INWARD",
            vehicle_number=vehicle,
            material=mat.name,
            supplier_or_customer=supplier,
            gross_weight=round(stock_qty * 1.35, 1),
            tare_weight=round(stock_qty * 0.35, 1),
            net_weight=stock_qty,
            gross_time=now_iso,
            tare_time=now_iso,
            status="COMPLETED",
            variance=0.0,
            challan_weight=stock_qty,
            received_rs=0.0,
            wb_name="Gate Scale #1",
            driver_name="Consignment Delivery Driver",
            watchman_name="Security Guard",
            gate_pass_no=f"GP-INW-{slug.upper()}-{idx:03d}",
            plant_id=new_plant_id
        )
        db.session.add(wb_ticket)

        tx = StockTransaction(
            material_id=mat.id,
            type="IN",
            quantity=stock_qty,
            reference=wb_ticket.ticket_number,
            note=f"Initial Silo & Bay Consignment Inwarded from {supplier}",
            created_by="Store Inventory Manager"
        )
        db.session.add(tx)

    # 5. Provision Fleet (Transit Mixers & Drivers) for this plant
    starter_fleet = [
        (f"MH40-{slug.upper()}-101", 8.0, "Ramesh Driver", "+91 98220 77001"),
        (f"MH40-{slug.upper()}-102", 8.0, "Suresh Driver", "+91 98220 77002"),
        (f"MH40-{slug.upper()}-103", 8.0, "Kishore Driver", "+91 98220 77003"),
        (f"MH40-{slug.upper()}-104", 8.0, "Gopal Driver", "+91 98220 77004"),
    ]
    for tm_no, cap, drv_name, drv_phone in starter_fleet:
        tr = Truck(tm_number=tm_no, capacity_cum=cap, status="AVAILABLE", plant_id=new_plant_id)
        db.session.add(tr)
        dr = Driver(name=drv_name, phone=drv_phone, license_no=f"DL-{slug.upper()}-{tm_no[-3:]}", status="AVAILABLE", plant_id=new_plant_id)
        db.session.add(dr)

    # 6. Weighbridge Settings
    wb_settings = WeighbridgeSettings(
        plant_id=new_plant_id,
        plant_name=org_name,
        wb_name=f"{org_name} WB-01"
    )
    db.session.add(wb_settings)
    db.session.commit()

    additional_claims = {
        "role": new_user.role,
        "base_role": new_user.role,
        "is_manager": new_user.is_manager,
        "customer_id": None,
        "name": new_user.name,
        "email": new_user.email,
        "plant": new_plant.name,
        "plant_id": new_plant.id
    }
    token = create_access_token(identity=new_user.id, additional_claims=additional_claims)

    return success_response(data={
        "token": token,
        "user": new_user.to_dict(),
        "message": f"Organization '{org_name}' successfully provisioned with dedicated customers, inwarded materials, and sub-logins."
    }, status_code=201)

@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return error_response(code="NOT_FOUND", message="User not found.", status_code=404)
    return success_response(data=user.to_dict())

@auth_bp.route("/change-password", methods=["POST"])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return error_response(code="NOT_FOUND", message="User not found.", status_code=404)

    data = request.get_json() or {}
    old_password = data.get("old_password", "")
    new_password = data.get("new_password", "")

    if not user.check_password(old_password):
        return error_response(code="INVALID_PASSWORD", message="Current password incorrect.", status_code=400)

    if len(new_password) < 6:
        return error_response(code="WEAK_PASSWORD", message="New password must be at least 6 characters.", status_code=400)

    user.set_password(new_password)
    db.session.commit()
    return success_response(data={"message": "Password changed successfully."})
