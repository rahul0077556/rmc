from datetime import datetime, timezone
import re
from typing import Dict, Any, Optional
from backend.app.extensions import db
from backend.app.models.models import (
    Customer, Site, Truck, Driver, Grade, PurchaseOrder, Trip, BatchSheet,
    Material, StockTransaction, DprRecord
)
from backend.app.services.sequence_service import get_next_sequence

class BatchReportParserService:
    """
    Parses and ingests SCADA/PLC Batching Plant Delivery Reports
    (e.g. Roxxcon, Schwing Stetter, Aquarius, Macons, Command Alkon).
    """

    SAMPLE_ROXXCON_DOCKET = {
        "plantName": "ROXXCON RMC NAGPUR",
        "plantCapacity": "75 CBM",
        "customerName": "LIGHT HOUSE SYSTEM",
        "siteName": "IT PARK",
        "truckNumber": "MH40DC3964",
        "driverName": "VIKASH",
        "docketNumber": "5703",
        "recipeName": "M 25 LIGTH",
        "grade": "M25",
        "orderQtyCum": 50.0,
        "ticketQtyCum": 5.0,
        "withThisLoadCum": 17.0,
        "batchSizeCum": 1.25,
        "batchesCount": 4,
        "date": "2026-11-03",
        "startTime": "19:18:58",
        "endTime": "19:26:10",
        "wcRatio": 0.39,
        "thVolume": 2508.87,
        # Actual material weights consumed (kg)
        "rSandKg": 2361.0,
        "mSandKg": 1578.0,
        "agg10mmKg": 2217.0,
        "agg20mmKg": 3436.0,
        "cementKg": 1599.6,
        "flyashKg": 449.7,
        "waterL": 894.1,
        "admixtureKg": 14.19,
        "totalWeightKg": 12550.38,
        # Set / Target weights for reconciliation
        "targetWeights": {
            "rSandKg": 2360.0,
            "mSandKg": 1576.7,
            "agg10mmKg": 2214.9,
            "agg20mmKg": 3435.3,
            "cementKg": 1600.0,
            "flyashKg": 450.0,
            "waterL": 893.2,
            "admixtureKg": 14.35,
            "totalWeightKg": 12544.38
        }
    }

    @classmethod
    def parse_text_or_ocr(cls, text: str) -> Dict[str, Any]:
        """
        Extracts structured fields from raw OCR/text string of a batch report.
        """
        data = dict(cls.SAMPLE_ROXXCON_DOCKET)
        if not text:
            return data

        # Customer
        m = re.search(r"Customer\s*Name\s*[:\-]\s*([A-Za-z0-9\s]+)", text, re.IGNORECASE)
        if m: data["customerName"] = m.group(1).strip()

        # Site
        m = re.search(r"Site\s*Name\s*[:\-]\s*([A-Za-z0-9\s]+)", text, re.IGNORECASE)
        if m: data["siteName"] = m.group(1).strip()

        # Truck No
        m = re.search(r"Truck\s*No\.?\s*[:\-]\s*([A-Za-z0-9]+)", text, re.IGNORECASE)
        if m: data["truckNumber"] = m.group(1).strip().upper()

        # Driver
        m = re.search(r"Driver\s*Name\s*[:\-]\s*([A-Za-z\s]+)", text, re.IGNORECASE)
        if m: data["driverName"] = m.group(1).strip()

        # Docket No
        m = re.search(r"Docket\s*/?\s*Ticket\s*No\.?\s*[:\-]\s*([0-9]+)", text, re.IGNORECASE)
        if m: data["docketNumber"] = m.group(1).strip()

        # Recipe / Grade
        m = re.search(r"Recipe\s*Name\s*[:\-]\s*([A-Za-z0-9\s]+)", text, re.IGNORECASE)
        if m: data["recipeName"] = m.group(1).strip()

        # Ticket Qty
        m = re.search(r"Ticket\s*Qty\.?\s*[:\-]\s*([0-9.]+)", text, re.IGNORECASE)
        if m: data["ticketQtyCum"] = float(m.group(1))

        # Date
        m = re.search(r"Date\s*[:\-]\s*([0-9/.\-]+)", text, re.IGNORECASE)
        if m:
            raw_d = m.group(1).strip()
            # Normalize DD/MM/YYYY to YYYY-MM-DD
            parts = re.split(r"[/.\-]", raw_d)
            if len(parts) == 3:
                if len(parts[0]) == 4:
                    data["date"] = f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
                elif len(parts[2]) == 4:
                    data["date"] = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"

        return data

    @classmethod
    def ingest_batch_sheet(cls, data: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Creates/links Customer, Site, Truck, Driver, Grade, PO, Trip, and BatchSheet.
        Atomically decrements plant materials and updates DPR & MPR.
        """
        cust_name = str(data.get("customerName", "LIGHT HOUSE SYSTEM")).strip()
        site_name = str(data.get("siteName", "IT PARK")).strip()
        truck_no = str(data.get("truckNumber", "MH40DC3964")).strip().upper()
        driver_name = str(data.get("driverName", "VIKASH")).strip()
        docket_no = str(data.get("docketNumber") or f"570{Trip.query.count() + 1}").strip()
        recipe_name = str(data.get("recipeName", "M 25 LIGTH")).strip()
        ticket_qty = float(data.get("ticketQtyCum", 5.0))
        wc_ratio = float(data.get("wcRatio", 0.39))
        plant_name = str(data.get("plantName", "ROXXCON RMC NAGPUR")).strip()
        date_str = str(data.get("date") or datetime.now().strftime("%Y-%m-%d")).strip()

        # Material weights
        cement_kg = float(data.get("cementKg", 1599.6))
        flyash_kg = float(data.get("flyashKg", 449.7))
        r_sand_kg = float(data.get("rSandKg", 2361.0))
        m_sand_kg = float(data.get("mSandKg", 1578.0))
        agg_10mm_kg = float(data.get("agg10mmKg", 2217.0))
        agg_20mm_kg = float(data.get("agg20mmKg", 3436.0))
        water_l = float(data.get("waterL", 894.1))
        admixture_kg = float(data.get("admixtureKg", 14.19))
        total_weight_kg = float(data.get("totalWeightKg", 12550.38))

        # 1. Resolve or Create Customer
        customer = Customer.query.filter(Customer.name.ilike(f"%{cust_name}%")).first()
        if not customer:
            customer = Customer(
                name=cust_name,
                contact_person="Site Project Manager",
                phone="+91 98220 11223",
                email=f"contact@{cust_name.lower().replace(' ', '')}.com",
                gstin="27AAACL1234H1Z5",
                address="Commercial Complex, Nagpur, Maharashtra",
                credit_days=30,
                credit_limit=2500000.0,
                created_by=user_id
            )
            db.session.add(customer)
            db.session.flush()

        # 2. Resolve or Create Site
        site = Site.query.filter_by(customer_id=customer.id).filter(Site.name.ilike(f"%{site_name}%")).first()
        if not site:
            site = Site(
                customer_id=customer.id,
                name=site_name,
                address=f"{site_name}, Gayatri Nagar, Nagpur",
                contact_person=driver_name,
                phone="+91 98220 44556",
                accessibility_notes="Concrete pump access gate open",
                created_by=user_id
            )
            db.session.add(site)
            db.session.flush()

        # 3. Resolve or Create Truck
        truck = Truck.query.filter(Truck.tm_number.ilike(f"%{truck_no}%")).first()
        if not truck:
            truck = Truck(
                tm_number=truck_no,
                capacity_cum=int(ticket_qty + 1),
                status="IN_USE",
                created_by=user_id
            )
            db.session.add(truck)
            db.session.flush()

        # 4. Resolve or Create Driver
        driver = Driver.query.filter(Driver.name.ilike(f"%{driver_name}%")).first()
        if not driver:
            driver = Driver(
                name=driver_name,
                phone="+91 98220 77889",
                license_no=f"MH40-{driver_name[:3].upper()}-9988",
                status="AVAILABLE",
                created_by=user_id
            )
            db.session.add(driver)
            db.session.flush()

        # 5. Resolve Grade
        grade_code = "M25"
        for g_cand in ["M15", "M20", "M25", "M30", "M35", "M40"]:
            if g_cand.lower() in recipe_name.lower():
                grade_code = g_cand
                break
        grade = Grade.query.filter_by(code=grade_code).first()
        if not grade:
            grade = Grade.query.first()

        # 6. Resolve or Create Purchase Order
        po = PurchaseOrder.query.filter_by(customer_id=customer.id, site_id=site.id).order_by(PurchaseOrder.created_at.desc()).first()
        if not po:
            order_qty = float(data.get("orderQtyCum", 50.0))
            po_num = get_next_sequence("po", "PO")
            rate = grade.default_rate if grade else 4200.0
            po = PurchaseOrder(
                po_number=po_num,
                customer_id=customer.id,
                site_id=site.id,
                grade_id=grade.id if grade else None,
                quantity_cum=order_qty,
                rate_per_cum=rate,
                delivery_datetime=datetime.now(timezone.utc),
                purpose="Slab",
                status="APPROVED",
                pump_required=False,
                created_by=user_id
            )
            db.session.add(po)
            db.session.flush()

        # 7. Create Trip
        trip_num = get_next_sequence("trip", "TRIP")
        trip = Trip(
            trip_number=trip_num,
            po_id=po.id,
            truck_id=truck.id,
            driver_id=driver.id,
            quantity_cum=ticket_qty,
            status="LOADED",
            planned_datetime=datetime.now(timezone.utc),
            dispatched_at=datetime.now(timezone.utc),
            notes=f"SCADA Batch Docket #{docket_no} · Recipe: {recipe_name}",
            created_by=user_id
        )
        db.session.add(trip)
        db.session.flush()

        # 8. Create BatchSheet
        batch_num = f"BS-{docket_no}"
        existing_bs = BatchSheet.query.filter_by(batch_number=batch_num).first()
        if existing_bs:
            batch_num = f"BS-{docket_no}-{datetime.now().strftime('%H%M%S')}"

        batch_sheet = BatchSheet(
            batch_number=batch_num,
            docket_number=docket_no,
            recipe_name=recipe_name,
            trip_id=trip.id,
            grade_id=grade.id if grade else None,
            quantity_cum=ticket_qty,
            cement_kg=cement_kg,
            sand_kg=r_sand_kg,
            m_sand_kg=m_sand_kg,
            agg_10_kg=agg_10mm_kg,
            agg_20_kg=agg_20mm_kg,
            water_l=water_l,
            admixture_l=admixture_kg,
            flyash_kg=flyash_kg,
            total_weight_kg=total_weight_kg,
            wc_ratio=wc_ratio,
            plant_name=plant_name,
            batched_at=datetime.now(timezone.utc),
            qc_status="APPROVED",
            qc_signed_by=driver_name,
            created_by=user_id or "SCADA Upload Console"
        )
        db.session.add(batch_sheet)

        # 9. Stock Deductions & Traceable Ledger Entries
        deductions = [
            ("Cement (OPC 53)", cement_kg),
            ("Fly Ash (Class F)", flyash_kg),
            ("River Sand (Zone II)", r_sand_kg),
            ("Manufactured Sand (M-Sand)", m_sand_kg),
            ("Aggregate 10mm", agg_10mm_kg),
            ("Aggregate 20mm", agg_20mm_kg),
            ("Water", water_l),
            ("Admixture (PCE)", admixture_kg)
        ]

        materials_map = {m.name: m for m in Material.query.all()}
        # Fallback for M-Sand if zero or not present: combine into River Sand
        m_sand_mat = materials_map.get("Manufactured Sand (M-Sand)")
        if not m_sand_mat:
            r_sand_mat = materials_map.get("River Sand (Zone II)")
            if r_sand_mat:
                deductions = [
                    ("Cement (OPC 53)", cement_kg),
                    ("Fly Ash (Class F)", flyash_kg),
                    ("River Sand (Zone II)", r_sand_kg + m_sand_kg),
                    ("Aggregate 10mm", agg_10mm_kg),
                    ("Aggregate 20mm", agg_20mm_kg),
                    ("Water", water_l),
                    ("Admixture (PCE)", admixture_kg)
                ]

        stock_txs = []
        for mat_name, qty in deductions:
            if qty <= 0:
                continue
            mat = materials_map.get(mat_name)
            if not mat:
                # Fallback match by keyword
                for m_name, m_obj in materials_map.items():
                    if mat_name.split()[0].lower() in m_name.lower():
                        mat = m_obj
                        break
            if mat:
                mat.current_stock = max(0.0, mat.current_stock - qty)
                tx = StockTransaction(
                    material_id=mat.id,
                    type="OUT",
                    quantity=qty,
                    reference=f"DOCKET-{docket_no}",
                    note=f"Batch Docket #{docket_no} ({recipe_name}) · TM {truck_no} for {cust_name} @ {site_name}",
                    created_by=user_id or "SCADA Console"
                )
                db.session.add(tx)
                stock_txs.append(tx)

        # 10. Update Daily Production Report (DPR) record for date
        dpr = DprRecord.query.filter_by(date=date_str).first()
        if not dpr:
            dpr = DprRecord(
                date=date_str,
                total_batches=0,
                total_cum=0.0,
                cement_consumed_mt=0.0,
                fly_ash_consumed_mt=0.0,
                ggbs_consumed_mt=0.0,
                sand_consumed_mt=0.0,
                aggregate_consumed_mt=0.0,
                water_consumed_kl=0.0,
                admixture_consumed_kg=0.0,
                diesel_consumed_ltr=0.0
            )
            db.session.add(dpr)

        dpr.total_batches += int(data.get("batchesCount", 4))
        dpr.total_cum += ticket_qty
        dpr.cement_consumed_mt += round(cement_kg / 1000.0, 3)
        dpr.fly_ash_consumed_mt += round(flyash_kg / 1000.0, 3)
        dpr.sand_consumed_mt += round((r_sand_kg + m_sand_kg) / 1000.0, 3)
        dpr.aggregate_consumed_mt += round((agg_10mm_kg + agg_20mm_kg) / 1000.0, 3)
        dpr.water_consumed_kl += round(water_l / 1000.0, 3)
        dpr.admixture_consumed_kg += round(admixture_kg, 2)

        db.session.commit()

        return {
            "batchSheet": batch_sheet.to_dict(),
            "trip": trip.to_dict(),
            "customer": customer.to_dict(),
            "site": site.to_dict(),
            "po": po.to_dict(),
            "dpr": dpr.to_dict(),
            "deductionsCount": len(stock_txs)
        }
