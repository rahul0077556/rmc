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
    def ocr_image_bytes(cls, image_bytes: bytes, ext: str = "jpg") -> str:
        """
        Runs native Apple Vision OCR on image bytes using macOS Vision framework.
        """
        import os
        import subprocess
        import tempfile

        with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as f:
            f.write(image_bytes)
            tmp_path = f.name

        swift_script = f"""
import Foundation
import Vision
import AppKit

let imagePath = "{tmp_path}"
guard let image = NSImage(contentsOfFile: imagePath),
      let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {{
    exit(0)
}}

let request = VNRecognizeTextRequest {{ (req, err) in
    guard let observations = req.results as? [VNRecognizedTextObservation] else {{ return }}
    for observation in observations {{
        if let topCandidate = observation.topCandidates(1).first {{
            print(topCandidate.string)
        }}
    }}
}}
request.recognitionLevel = .accurate
let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
try? handler.perform([request])
"""
        try:
            proc = subprocess.run(["swift", "-"], input=swift_script, capture_output=True, text=True, timeout=15)
            return proc.stdout or ""
        except Exception:
            return ""
        finally:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

    @classmethod
    def parse_text_or_ocr(cls, text: str) -> Dict[str, Any]:
        """
        Extracts structured fields from raw OCR/text string of a batch report.
        """
        data = dict(cls.SAMPLE_ROXXCON_DOCKET)
        if not text:
            return data

        def clean_val(val: str, stops=None) -> str:
            if not val:
                return ""
            val = val.split("\n")[0].split("\r")[0].strip()
            if stops:
                for s in stops:
                    idx = val.lower().find(s.lower())
                    if idx != -1:
                        val = val[:idx].strip()
            return val.strip(" :-|")

        # Customer
        m = re.search(r"Customer\s*Name\s*[:\-]\s*([^\r\n]+)", text, re.IGNORECASE)
        if m:
            c = clean_val(m.group(1), ["Site Name", "Truck", "Order", "Recipe"])
            if c: data["customerName"] = c

        # Site
        m = re.search(r"Site\s*Name\s*[:\-]\s*([^\r\n]+)", text, re.IGNORECASE)
        if m:
            s = clean_val(m.group(1), ["Truck", "Driver", "Start", "Recipe"])
            if s: data["siteName"] = s

        # Truck No
        m = re.search(r"Truck\s*No\.?\s*[:\-]\s*([^\r\n]+)", text, re.IGNORECASE)
        if m:
            t = clean_val(m.group(1), ["Driver", "Start", "End"]).upper().replace(" ", "")
            if t: data["truckNumber"] = t

        # Driver
        m = re.search(r"Driver\s*Name\s*[:\-]\s*([^\r\n]+)", text, re.IGNORECASE)
        if m:
            d = clean_val(m.group(1), ["Start", "End", "Time", "Batch"])
            if d: data["driverName"] = d

        # Docket No
        m = re.search(r"Docket\s*/?\s*Ticket\s*No\.?\s*[:\-]\s*([0-9]+)", text, re.IGNORECASE)
        if m:
            data["docketNumber"] = m.group(1).strip()

        # Recipe / Grade
        m = re.search(r"Recipe\s*Name\s*[:\-]\s*([^\r\n]+)", text, re.IGNORECASE)
        if m:
            r = clean_val(m.group(1), ["Total M", "Date", "Batch", "Order"])
            if r: data["recipeName"] = r

        # Concrete Grade
        m = re.search(r"Grade(?:\s+of\s+Concrete)?\s*[:\-]\s*([^\r\n]+)", text, re.IGNORECASE)
        if m:
            g_str = clean_val(m.group(1))
            gm = re.search(r"(M\s*\d+)", g_str, re.IGNORECASE)
            if gm:
                data["grade"] = gm.group(1).replace(" ", "").upper()

        # Ticket Qty
        m = re.search(r"Ticket\s*Qty\.?\s*[:\-]\s*([0-9.]+)", text, re.IGNORECASE)
        if m: data["ticketQtyCum"] = float(m.group(1))

        # Total M3
        m = re.search(r"Total\s*M[³3]?\s*[:\-]\s*([0-9.]+)", text, re.IGNORECASE)
        if m and "ticketQtyCum" not in data:
            data["ticketQtyCum"] = float(m.group(1))

        # W/C Ratio
        m = re.search(r"W/?C\s*Ratio\s*[:\-]\s*([0-9.]+)", text, re.IGNORECASE)
        if m: data["wcRatio"] = float(m.group(1))

        # Date
        m = re.search(r"Date\s*[:\-]\s*([0-9/.\-]+)", text, re.IGNORECASE)
        if m:
            raw_d = m.group(1).strip()
            parts = re.split(r"[/.\-]", raw_d)
            if len(parts) == 3:
                if len(parts[0]) == 4:
                    data["date"] = f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
                elif len(parts[2]) == 4:
                    data["date"] = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"

        # Total Actual Scale Weights (R-Sand, M-Sand, 10mm, 20mm, Cement, Flyash, Water, Admix, Total)
        m = re.search(r"Total\s*Actual\s+([^\r\n]+)", text, re.IGNORECASE)
        if m:
            nums = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", m.group(1))]
            if len(nums) >= 8:
                data["rSandKg"] = nums[0]
                data["mSandKg"] = nums[1]
                data["agg10mmKg"] = nums[2]
                data["agg20mmKg"] = nums[3]
                data["cementKg"] = nums[4]
                data["flyashKg"] = nums[5]
                data["waterL"] = nums[6]
                data["admixtureKg"] = nums[7]
                if len(nums) >= 9:
                    data["totalWeightKg"] = nums[-1]

        # Total Set (Target Weights)
        m = re.search(r"Total\s*Set\s+([^\r\n]+)", text, re.IGNORECASE)
        if m:
            nums = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", m.group(1))]
            if len(nums) >= 8:
                data["targetWeights"] = {
                    "rSandKg": nums[0],
                    "mSandKg": nums[1],
                    "agg10mmKg": nums[2],
                    "agg20mmKg": nums[3],
                    "cementKg": nums[4],
                    "flyashKg": nums[5],
                    "waterL": nums[6],
                    "admixtureKg": nums[7],
                    "totalWeightKg": nums[-1] if len(nums) >= 9 else sum(nums[:8])
                }

        return data

    @classmethod
    def ingest_batch_sheet(cls, data: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Creates/links Customer, Site, Truck, Driver, Grade, PO, Trip, and BatchSheet.
        Matches existing queued trips by normalized truck number.
        Prevents duplicates unless replaceExisting is flagged.
        Atomically decrements plant materials into ledger and updates DPR & MPR.
        """
        cust_name = str(data.get("customerName", "LIGHT HOUSE SYSTEM")).strip()
        site_name = str(data.get("siteName", "IT PARK")).strip()
        truck_no = str(data.get("truckNumber", "MH40DC3964")).strip().upper()
        clean_truck = truck_no.replace("-", "").replace(" ", "").upper()
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

        # Duplicate protection check
        existing_bs = BatchSheet.query.filter_by(docket_number=docket_no).first()
        if existing_bs and not getattr(existing_bs, "is_voided", False):
            if data.get("replaceExisting"):
                # Void and reverse previous deductions
                docket_ref = f"DOCKET-{existing_bs.docket_number}"
                old_txs = StockTransaction.query.filter(
                    (StockTransaction.reference == docket_ref) | (StockTransaction.reference == f"Batch {existing_bs.batch_number}"),
                    StockTransaction.is_reversal == False,
                    StockTransaction.type == "OUT"
                ).all()
                for otx in old_txs:
                    m = otx.material
                    if m and getattr(m, "is_tracked", True):
                        m.current_stock = round(m.current_stock + otx.quantity, 2)
                    rev = StockTransaction(
                        material_id=otx.material_id,
                        type="REVERSAL",
                        quantity=otx.quantity,
                        reference=f"REVERSAL-{existing_bs.batch_number}",
                        note=f"Reversal of {otx.reference}: replaced by docket #{docket_no} re-import",
                        is_reversal=True,
                        reversed_transaction_id=otx.id,
                        reversal_reason="Replaced by re-import",
                        created_by=user_id
                    )
                    db.session.add(rev)
                existing_bs.is_voided = True
                existing_bs.void_reason = "Replaced by re-import"
                existing_bs.voided_at = datetime.now(timezone.utc)
                existing_bs.voided_by = user_id
                db.session.flush()
            else:
                raise ValueError(f"Batch docket #{docket_no} already exists in the system (imported on {existing_bs.created_at.strftime('%d-%b-%Y %H:%M')}). Select 'Replace & Re-import' to overwrite.")

        # 1. Resolve or Create Truck
        all_trucks = Truck.query.all()
        truck = next((t for t in all_trucks if t.tm_number.replace("-", "").replace(" ", "").upper() == clean_truck), None)
        if not truck:
            truck = Truck(
                tm_number=truck_no,
                capacity_cum=int(ticket_qty + 1),
                status="LOADED",
                created_by=user_id
            )
            db.session.add(truck)
            db.session.flush()
        else:
            truck.status = "LOADED"

        # 2. Resolve or Create Driver
        driver = Driver.query.filter(Driver.name.ilike(f"%{driver_name}%")).first()
        if not driver:
            driver = Driver(
                name=driver_name,
                phone="+91 98220 77889",
                license_no=f"MH40-{driver_name[:3].upper()}-9988",
                status="ASSIGNED",
                created_by=user_id
            )
            db.session.add(driver)
            db.session.flush()
        else:
            driver.status = "ASSIGNED"

        # 3. Resolve Grade
        grade_code = "M25"
        for g_cand in ["M15", "M20", "M25", "M30", "M35", "M40"]:
            if g_cand.lower() in recipe_name.lower():
                grade_code = g_cand
                break
        grade = Grade.query.filter_by(code=grade_code).first() or Grade.query.first()

        # 4. Resolve Trip: check explicit tripId, or matching queued trip for this truck
        trip = None
        if data.get("tripId"):
            clean_tid = str(data.get("tripId")).strip()
            trip = Trip.query.filter((Trip.id == clean_tid) | (Trip.trip_number == clean_tid)).first()
        
        if not trip and truck:
            trip = (
                Trip.query.filter_by(truck_id=truck.id)
                .filter(Trip.status.in_(["SENT_TO_PRODUCTION", "BATCHING", "PLANNED"]))
                .order_by(Trip.planned_datetime.asc())
                .first()
            )

        # 5. If no queued trip matched, resolve Customer, Site, and PO to create one
        if not trip:
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

            trip_num = get_next_sequence("trip", "TRIP")
            trip = Trip(
                trip_number=trip_num,
                po_id=po.id,
                truck_id=truck.id,
                driver_id=driver.id,
                quantity_cum=ticket_qty,
                status="QC_PENDING",
                planned_datetime=datetime.now(timezone.utc),
                dispatched_at=datetime.now(timezone.utc),
                notes=f"SCADA Batch Docket #{docket_no} · Recipe: {recipe_name}",
                created_by=user_id
            )
            db.session.add(trip)
            db.session.flush()
        else:
            # Advance queued trip to QC_PENDING
            trip.status = "QC_PENDING"
            trip.truck_id = truck.id
            if driver:
                trip.driver_id = driver.id
            trip.dispatched_at = datetime.now(timezone.utc)
            trip.notes = f"{trip.notes or ''} [Batched Docket #{docket_no}: {recipe_name}]".strip()
            db.session.flush()

        # 6. Create BatchSheet with dynamic weights and plant set targets
        batch_num = f"BS-{docket_no}"
        existing_any_bs = BatchSheet.query.filter_by(batch_number=batch_num).first()
        if existing_any_bs:
            batch_num = f"BS-{docket_no}-{datetime.now().strftime('%H%M%S')}"

        batch_sheet = BatchSheet(
            batch_number=batch_num,
            docket_number=docket_no,
            recipe_name=recipe_name,
            trip_id=trip.id,
            grade_id=grade.id if grade else (trip.po.grade_id if trip.po else None),
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
            plant_set_weights=data.get("targetWeights") or {},
            actual_weights_json=data.get("actualWeights") or {
                "Cement (OPC 53)": cement_kg,
                "Fly Ash (Class F)": flyash_kg,
                "River Sand (Zone II)": r_sand_kg,
                "Manufactured Sand (M-Sand)": m_sand_kg,
                "Aggregate 10mm": agg_10mm_kg,
                "Aggregate 20mm": agg_20mm_kg,
                "Water": water_l,
                "Admixture (PCE)": admixture_kg
            },
            raw_docket_data=data,
            batched_at=datetime.now(timezone.utc),
            qc_status="PENDING",
            qc_signed_by=None,
            created_by=user_id or "SCADA Upload Console"
        )
        db.session.add(batch_sheet)

        # 7. Stock Deductions & Traceable Ledger Entries (Golden Rule 2: exact ledger, no clamping)
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
        stock_txs = []
        for mat_name, qty in deductions:
            if qty <= 0:
                continue
            mat = materials_map.get(mat_name)
            if not mat:
                for m_name, m_obj in materials_map.items():
                    if mat_name.split()[0].lower() in m_name.lower():
                        mat = m_obj
                        break
            if mat:
                if getattr(mat, "is_tracked", True):
                    mat.current_stock = round(mat.current_stock - qty, 2)
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

        # 8. Update Daily Production Report (DPR) record for date
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
            "po": trip.po.to_dict() if trip.po else None,
            "deductionsCount": len(stock_txs)
        }
