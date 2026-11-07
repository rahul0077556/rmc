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
        Dynamically extracts structured fields, arbitrary materials table,
        cycle batches, and verification balances from raw text or OCR output.
        Layout-independent and header-driven.
        """
        if not text or len(text.strip()) < 15:
            return {
                "isReadable": False,
                "error": "The uploaded batch sheet could not be parsed automatically. Please ensure the document is legible.",
                "rawText": text or "",
                "materials": [],
                "cycles": [],
                "discrepancies": ["No readable text found in document."],
                "isVerified": False
            }

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

        def get_val(pat: str) -> Optional[str]:
            m = re.search(pat, text, re.IGNORECASE)
            return m.group(1).strip() if m else None

        # Parallel label/value detection for OCR multi-column text (e.g. scanned sheets)
        lines_all = [l.strip() for l in text.split("\n") if l.strip()]
        lbl_cands = ["Customer Name", "Site Name", "Truck No.", "Driver Name", "Start Time", "End Time", "Batch Size", "Recipe Name", "Total M°", "Total M³", "Date", "W/C Ratio", "Grade of Concrete"]
        det_lbls = []
        det_vals = []
        for l in lines_all:
            if l in lbl_cands:
                det_lbls.append(l)
            elif l.startswith(":") and len(det_lbls) > len(det_vals):
                det_vals.append(l.lstrip(": ").strip())
        parallel_kv = dict(zip(det_lbls, det_vals))

        stops = ["Site Name", "Site:", "Truck", "Driver", "Start", "End", "Recipe", "Order", "Page", "Date", "|"]

        # 1. Metadata Extraction
        customer_name = clean_val(get_val(r"Customer\s*Name\s*[:\-]\s*([^\r\n]+)") or get_val(r"Customer\s*:\s*([^\r\n|]+)") or parallel_kv.get("Customer Name"), stops)
        site_name = clean_val(get_val(r"Site\s*Name\s*[:\-]\s*([^\r\n]+)") or get_val(r"Site\s*:\s*([^\r\n|]+)") or parallel_kv.get("Site Name"), stops)
        raw_truck = get_val(r"Truck\s*No\.?\s*[:\-]\s*([^\r\n]+)") or get_val(r"Truck\s*:\s*([^\r\n|]+)") or parallel_kv.get("Truck No.") or ""
        truck_number = clean_val(raw_truck, ["Driver", "Start", "End"]).upper().replace(" ", "").replace("-", "")
        driver_name = clean_val(get_val(r"Driver\s*Name\s*[:\-]\s*([^\r\n]+)") or get_val(r"Driver\s*:\s*([^\r\n|]+)") or parallel_kv.get("Driver Name"), ["Start", "End", "Time", "Batch", "Docket"])
        docket_number = get_val(r"Docket\s*(?:/\s*Ticket)?\s*No\.?\s*[:\-]\s*([A-Za-z0-9\-]+)") or get_val(r"Docket\s*No:?\s*([0-9]+)") or get_val(r"Ticket\s*#?\s*[:\-]?\s*([0-9]+)") or ""
        recipe_name = clean_val(get_val(r"Recipe\s*Name\s*[:\-]\s*([^\r\n]+)") or get_val(r"Recipe\s*:\s*([^\r\n|]+)") or parallel_kv.get("Recipe Name"), ["Total M", "Date", "Batch", "Order"])
        raw_grade = clean_val(get_val(r"Grade(?:\s+of\s+Concrete)?\s*[:\-]\s*([^\r\n]+)") or parallel_kv.get("Grade of Concrete") or "")
        gm = re.search(r"(M\s*\d+)", raw_grade or recipe_name or "", re.IGNORECASE)
        grade = gm.group(1).replace(" ", "").upper() if gm else (raw_grade if raw_grade else "M25")

        start_time = get_val(r"Start\s*Time\s*[:\-]\s*([0-9:]+)") or parallel_kv.get("Start Time") or ""
        end_time = get_val(r"End\s*Time\s*[:\-]\s*([0-9:]+)") or parallel_kv.get("End Time") or ""

        raw_ticket_qty = get_val(r"(?:Ticket\s*Qty|Total\s*M[³3]?)\.?\s*[:\-]\s*([0-9.]+)") or parallel_kv.get("Total M°") or parallel_kv.get("Total M³")
        ticket_qty = float(re.search(r"[0-9.]+", raw_ticket_qty).group(0)) if raw_ticket_qty else 0.0

        raw_batch_size = get_val(r"Batch\s*Size\s*[:\-]\s*([0-9.]+)") or parallel_kv.get("Batch Size")
        batch_size = float(re.search(r"[0-9.]+", raw_batch_size).group(0)) if raw_batch_size else 0.0

        order_qty = float(get_val(r"Order\s*Qty\.?\s*[:\-]\s*([0-9.]+)") or 0.0)
        with_this_load = float(get_val(r"With\s*This\s*Load\s*[:\-]\s*([0-9.]+)") or 0.0)

        raw_wc = get_val(r"W/?C\s*Ratio\s*[:\-]\s*([0-9.]+)") or parallel_kv.get("W/C Ratio")
        wc_ratio = float(re.search(r"[0-9.]+", raw_wc).group(0)) if raw_wc else 0.0

        th_volume = float(get_val(r"TH\s*[vV]olume\s*[:\-]\s*([0-9.]+)") or 0.0)

        plant_name = clean_val(get_val(r"Plant\s*Name\s*[:\-]\s*([^\r\n]+)") or get_val(r"BATCH\s*REPORT\s*-\s*DELIVERY\s+([^\r\n]+)") or "")
        plant_capacity = clean_val(get_val(r"Plant\s*Capacity\s*[:\-]\s*([^\r\n]+)") or "")

        # Date normalization
        raw_date = get_val(r"Date\s*[:\-]\s*([0-9/.\-]+)") or parallel_kv.get("Date") or ""
        normalized_date = ""
        if raw_date:
            parts = re.split(r"[/.\-]", raw_date.strip())
            if len(parts) == 3:
                if len(parts[0]) == 4:
                    normalized_date = f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
                elif len(parts[2]) == 4:
                    normalized_date = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
                else:
                    normalized_date = f"20{parts[2].zfill(2)}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"

        # 2. Extract Table Numbers (Total Actual, Total Set, Variance %)
        m_act = re.search(r"Total\s*Actual\s+([^\r\n]+)", text, re.IGNORECASE)
        nums_act = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", m_act.group(1))] if m_act else []

        m_set = re.search(r"Total\s*Set\s+([^\r\n]+)", text, re.IGNORECASE)
        nums_set = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", m_set.group(1))] if m_set else []

        m_var = re.search(r"Variance\s*%\s+([^\r\n]+)", text, re.IGNORECASE)
        nums_var = [float(x) for x in re.findall(r"[-+]?\d+(?:\.\d+)?", m_var.group(1))] if m_var else []

        # 3. Dynamic Material Name & Recipe Extraction
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        noise_headers = {
            "channel", "m. name", "recipe/m³", "recipe m³", "batch no", "act", "total kg",
            "time", "(sec)", "supervisor", "operator", "absorption %", "average", "target", "variance"
        }

        def is_table_group_header(l_str: str) -> bool:
            low = l_str.lower()
            return (
                "aggregate (kg)" in low
                or "water (ltr/kg)" in low
                or "cement (kg)" in low
                or "binder (kg)" in low
                or "cementitious materials" in low
                or "pce admix" in low
                or "chemical admixtures" in low
                or "fine & coarse" in low
            )

        mat_candidates = []
        in_table = False
        for l in lines:
            llow = l.lower()
            if any(k in llow for k in ["channel", "batch no", "recipe/m³", "recipe m³"]):
                in_table = True
                continue
            if in_table:
                if "act %m" in llow or re.match(r"^\d+\s+\d+\s*s", l):
                    break
                if llow in noise_headers or is_table_group_header(l):
                    continue
                mat_candidates.append(l)

        parsed_materials = []
        ci = 0
        while ci < len(mat_candidates):
            item = mat_candidates[ci]
            if not re.match(r"^\d+(?:\.\d+)?$", item):
                mname = item
                rval = 0.0
                if ci + 1 < len(mat_candidates) and re.match(r"^\d+(?:\.\d+)?$", mat_candidates[ci + 1]):
                    rval = float(mat_candidates[ci + 1])
                    ci += 2
                else:
                    ci += 1
                parsed_materials.append({"name": mname, "recipeKg": rval})
            else:
                ci += 1

        # If material count doesn't match numbers count, align gracefully
        num_mats_expected = len(nums_act) - 1 if (len(nums_act) > 0 and len(nums_set) > 0 and abs(nums_act[-1] - sum(nums_act[:-1])) < 5.0) else len(nums_act)
        
        materials_result = []
        for idx in range(num_mats_expected):
            mat_name = parsed_materials[idx]["name"] if idx < len(parsed_materials) else f"Material {idx+1}"
            recipe_val = parsed_materials[idx]["recipeKg"] if idx < len(parsed_materials) else 0.0
            act_val = nums_act[idx] if idx < len(nums_act) else 0.0
            set_val = nums_set[idx] if idx < len(nums_set) else 0.0
            var_pct = nums_var[idx] if idx < len(nums_var) else (round(((act_val - set_val) / set_val) * 100, 2) if set_val > 0 else 0.0)
            var_kg = round(act_val - set_val, 2)

            unit = "L" if any(u in mat_name.lower() for u in ["water", "admix", "additive", "ltr", "retarder"]) else "kg"

            materials_result.append({
                "name": mat_name,
                "recipeKg": recipe_val,
                "setKg": set_val,
                "actualKg": act_val,
                "varianceKg": var_kg,
                "variancePct": var_pct,
                "unit": unit
            })

        # Fallback for vertical multi-column OCR format (e.g. scanned dockets)
        if not materials_result:
            known_mats = [
                ("RIVER SAND", "RIVER SAND"),
                ("CRUSHED SAND", "CRUSHED SAND"),
                ("M SAND", "M SAND"),
                ("R SAND", "R SAND"),
                ("WASHED SAND", "WASHED SAND"),
                ("10 MM AGG", "10MM AGG"),
                ("10MM AGG", "10MM AGG"),
                ("10 MM", "10MM AGG"),
                ("20 MM AGG", "20MM AGG"),
                ("20MM AGG", "20MM AGG"),
                ("20 MM", "20MM AGG"),
                ("32 MM PAVING", "32 MM PAVING"),
                ("40 MM BALLAST", "40 MM BALLAST"),
                ("OPC 43", "OPC 43"),
                ("OPC 53", "OPC 53"),
                ("CEMENT 1", "CEMENT 1"),
                ("FLYASH (F)", "FLYASH (F)"),
                ("FLYASH", "FLYASH"),
                ("WATER", "WATER"),
                ("PP FIBER (kg)", "PP FIBER"),
                ("PP FIBER", "PP FIBER"),
                ("SUPERPLAST (kg)", "SUPERPLAST"),
                ("SUPERPLAST", "SUPERPLAST"),
                ("AEA (Itr)", "AEA"),
                ("AEA (ltr)", "AEA"),
                ("AEA", "AEA"),
                ("POLYCARBOXYLATE", "POLYCARBOXYLATE"),
                ("RETARDER", "RETARDER"),
                ("SILICA FUME", "SILICA FUME"),
                ("GGBS", "GGBS")
            ]
            seen_mats = set()
            for pattern, clean_name in known_mats:
                if clean_name in seen_mats:
                    continue
                idx = text.find(pattern)
                if idx == -1:
                    continue
                snippet = text[idx:idx + 380]
                m_rec = re.search(rf"{re.escape(pattern)}\s*\n\s*(\d+(?:\.\d+)?)", snippet)
                if not m_rec:
                    m_rec = re.search(rf"{re.escape(pattern)}\s*\n\s*(\d+\.?\d+\.?\d*)", snippet)
                    if m_rec:
                        raw_r = m_rec.group(1).replace(".", "", m_rec.group(1).count(".") - 1)
                        try:
                            recipe = float(raw_r)
                        except Exception:
                            continue
                    else:
                        continue
                else:
                    recipe = float(m_rec.group(1))

                effective_ticket_qty = ticket_qty if ticket_qty > 0 else 6.0
                expected_set = round(recipe * effective_ticket_qty, 2)

                nums = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", snippet)]
                candidates = [n for n in nums if expected_set > 0 and abs(n - expected_set) / max(expected_set, 1) < 0.06 and n > 0.5]
                if candidates:
                    cand_set = min(candidates, key=lambda x: abs(x - expected_set))
                    set_idx = nums.index(cand_set)
                    act_val = nums[set_idx - 1] if set_idx > 0 else cand_set
                    if abs(act_val - cand_set) / max(cand_set, 1) > 0.06:
                        act_val = cand_set

                    var_pct = round(((act_val - cand_set) / cand_set) * 100, 2) if cand_set > 0 else 0.0
                    unit = "L" if any(u in clean_name.lower() for u in ["water", "admix", "superplast", "aea", "ltr", "retarder"]) else "kg"

                    materials_result.append({
                        "name": clean_name,
                        "recipeKg": recipe,
                        "setKg": cand_set,
                        "actualKg": act_val,
                        "varianceKg": round(act_val - cand_set, 2),
                        "variancePct": var_pct,
                        "unit": unit
                    })
                    seen_mats.add(clean_name)

        # 4. Cycle Details Extraction
        cycle_lines = re.findall(r"^(\d+)\s+(\d+)\s*s?\s+([0-9.\s]+)$", text, re.MULTILINE)
        cycles_result = []
        for c_num, c_sec, c_rest in cycle_lines:
            c_vals = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", c_rest)]
            c_tot = c_vals[-1] if c_vals else 0.0
            cycles_result.append({
                "cycleNo": int(c_num),
                "durationSec": int(c_sec),
                "totalKg": c_tot,
                "weights": c_vals[:-1] if c_vals else []
            })

        # Total Weights
        total_actual_kg = nums_act[-1] if (len(nums_act) > num_mats_expected) else sum(m["actualKg"] for m in materials_result)
        total_set_kg = nums_set[-1] if (len(nums_set) > num_mats_expected) else sum(m["setKg"] for m in materials_result)

        # 5. Mathematical Balance & Discrepancy Checks
        discrepancies = []
        
        # Check A: Cycles vs Total Actual Weight
        if cycles_result and total_actual_kg > 0:
            sum_cycle_weights = round(sum(c["totalKg"] for c in cycles_result), 2)
            if abs(sum_cycle_weights - total_actual_kg) > 2.0:
                discrepancies.append(
                    f"Cycle batch weights sum ({sum_cycle_weights:.2f} kg) differs from total actual scale weight ({total_actual_kg:.2f} kg)."
                )

        # Check B: Batch count & batch size vs Ticket Quantity
        batches_count = len(cycles_result) or int(get_val(r"Batches\s*(?:Count)?\s*[:\-]\s*(\d+)") or 0)
        if batches_count > 0 and batch_size > 0 and ticket_qty > 0:
            calc_ticket_qty = round(batches_count * batch_size, 2)
            if abs(calc_ticket_qty - ticket_qty) > 0.15:
                discrepancies.append(
                    f"Calculated quantity ({batches_count} cycles × {batch_size:.2f} m³ = {calc_ticket_qty:.2f} m³) differs from ticket quantity ({ticket_qty:.2f} m³)."
                )

        # Check C: W/C Ratio Verification
        # Sum recipe water & binders (for target W/C) and actual water & binders (for batched W/C)
        recipe_water = 0.0
        recipe_binders = 0.0
        actual_water = 0.0
        actual_binders = 0.0
        for m in materials_result:
            m_low = m["name"].lower()
            if "water" in m_low:
                recipe_water += m["recipeKg"]
                actual_water += m["actualKg"]
            elif any(b in m_low for b in ["cement", "opc", "ppc", "flyash", "fly ash", "ggbs", "silica", "slag", "binder"]):
                recipe_binders += m["recipeKg"]
                actual_binders += m["actualKg"]

        calc_target_wc = round(recipe_water / recipe_binders, 2) if recipe_binders > 0 else 0.0
        calc_actual_wc = round(actual_water / actual_binders, 2) if actual_binders > 0 else 0.0

        if wc_ratio > 0:
            # If sheet W/C doesn't match recipe target W/C or batched W/C within tolerance
            if abs(calc_target_wc - wc_ratio) > 0.04 and abs(calc_actual_wc - wc_ratio) > 0.08:
                discrepancies.append(
                    f"Sheet W/C ratio ({wc_ratio:.2f}) diverges from calculated mix design W/C ratio (target: {calc_target_wc:.2f}, actual batched: {calc_actual_wc:.2f})."
                )

        # Check D: Material Tolerance Bounds (±2% cement/water, ±3% aggregates)
        for m in materials_result:
            m_low = m["name"].lower()
            vp = abs(m["variancePct"])
            is_binder_or_water = any(k in m_low for k in ["cement", "opc", "flyash", "water"])
            tol = 2.0 if is_binder_or_water else 3.0
            if m["setKg"] > 0 and vp > tol:
                discrepancies.append(
                    f"{m['name']}: Actual batch variance ({m['variancePct']:+.2f}%) exceeds plant tolerance (±{tol:.1f}%)."
                )

        # Backward compatibility field mapping for existing callers
        data = {
            "isReadable": True,
            "docketNumber": docket_number,
            "customerName": customer_name,
            "siteName": site_name,
            "truckNumber": truck_number,
            "driverName": driver_name,
            "startTime": start_time,
            "endTime": end_time,
            "recipeName": recipe_name,
            "grade": grade,
            "ticketQtyCum": ticket_qty,
            "batchSizeCum": batch_size,
            "batchesCount": batches_count,
            "orderQtyCum": order_qty,
            "withThisLoadCum": with_this_load,
            "wcRatio": wc_ratio,
            "plantName": plant_name,
            "plantCapacity": plant_capacity,
            "date": normalized_date or raw_date,
            "thVolume": th_volume,
            "materials": materials_result,
            "cycles": cycles_result,
            "totalWeightKg": total_actual_kg,
            "totals": {
                "actualKg": total_actual_kg,
                "setKg": total_set_kg,
                "varianceKg": round(total_actual_kg - total_set_kg, 2),
                "variancePct": round(((total_actual_kg - total_set_kg) / total_set_kg) * 100, 2) if total_set_kg > 0 else 0.0
            },
            "discrepancies": discrepancies,
            "isVerified": len(discrepancies) == 0,
            "rawText": text
        }

        # Legacy direct keys for backward compatibility
        for m in materials_result:
            mlow = m["name"].lower()
            if "r sand" in mlow or "river sand" in mlow:
                data["rSandKg"] = m["actualKg"]
            elif "m sand" in mlow or "crushed sand" in mlow:
                data["mSandKg"] = m["actualKg"]
            elif "10" in mlow:
                data["agg10mmKg"] = m["actualKg"]
            elif "20" in mlow:
                data["agg20mmKg"] = m["actualKg"]
            elif "cement" in mlow or "opc" in mlow:
                data["cementKg"] = m["actualKg"]
            elif "flyash" in mlow or "fly ash" in mlow:
                data["flyashKg"] = m["actualKg"]
            elif "water" in mlow:
                data["waterL"] = m["actualKg"]
            elif "admix" in mlow or "additive" in mlow or "superplast" in mlow or "polycarb" in mlow:
                data["admixtureKg"] = m["actualKg"]

        data["actualWeights"] = {m["name"]: m["actualKg"] for m in materials_result}
        data["targetWeights"] = {m["name"]: m["setKg"] for m in materials_result}

        return data

    @classmethod
    def ingest_batch_sheet(cls, data: Dict[str, Any], user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Creates/links Customer, Site, Truck, Driver, Grade, PO, Trip, and BatchSheet.
        Matches existing queued trips by normalized truck number.
        Prevents duplicates unless replaceExisting is flagged.
        Atomically decrements plant materials into ledger and updates DPR & MPR.
        """
        cust_name = str(data.get("customerName") or "").strip()
        site_name = str(data.get("siteName") or "").strip()
        truck_no = str(data.get("truckNumber") or "").strip().upper()
        clean_truck = truck_no.replace("-", "").replace(" ", "").upper()
        driver_name = str(data.get("driverName") or "Plant Driver").strip()
        docket_no = str(data.get("docketNumber") or f"580{Trip.query.count() + 1}").strip()
        recipe_name = str(data.get("recipeName") or "Standard Mix").strip()
        ticket_qty = float(data.get("ticketQtyCum") or data.get("quantity") or 6.0)
        wc_ratio = float(data.get("wcRatio") or 0.38)
        plant_name = str(data.get("plantName") or "").strip()
        date_str = str(data.get("date") or datetime.now().strftime("%Y-%m-%d")).strip()

        # Build dynamic materials map from submitted materials table or actualWeights
        materials_list = data.get("materials") or []
        actual_dict = {}
        target_dict = {}
        if materials_list:
            for m in materials_list:
                m_name = m.get("name", "").strip()
                m_act = float(m.get("actualKg", 0.0))
                m_set = float(m.get("setKg", 0.0))
                if m_name and m_act > 0:
                    actual_dict[m_name] = m_act
                    target_dict[m_name] = m_set
        
        if not actual_dict:
            actual_dict = dict(data.get("actualWeights") or {})
            target_dict = dict(data.get("targetWeights") or {})

        total_weight_kg = float(data.get("totalWeightKg") or sum(actual_dict.values()) or 0.0)

        # Direct material weights for traditional columns
        cement_kg = float(data.get("cementKg") or next((v for k, v in actual_dict.items() if "cement" in k.lower() or "opc" in k.lower()), 0.0))
        flyash_kg = float(data.get("flyashKg") or next((v for k, v in actual_dict.items() if "flyash" in k.lower() or "fly ash" in k.lower()), 0.0))
        r_sand_kg = float(data.get("rSandKg") or next((v for k, v in actual_dict.items() if "r sand" in k.lower() or "river" in k.lower()), 0.0))
        m_sand_kg = float(data.get("mSandKg") or next((v for k, v in actual_dict.items() if "m sand" in k.lower() or "crushed" in k.lower()), 0.0))
        agg_10mm_kg = float(data.get("agg10mmKg") or next((v for k, v in actual_dict.items() if "10" in k.lower()), 0.0))
        agg_20mm_kg = float(data.get("agg20mmKg") or next((v for k, v in actual_dict.items() if "20" in k.lower() or "32" in k.lower()), 0.0))
        water_l = float(data.get("waterL") or next((v for k, v in actual_dict.items() if "water" in k.lower()), 0.0))
        admixture_kg = float(data.get("admixtureKg") or next((v for k, v in actual_dict.items() if "admix" in k.lower() or "additive" in k.lower() or "superplast" in k.lower() or "polycarb" in k.lower()), 0.0))

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
        if not actual_dict:
            actual_dict = dict(data.get("actualWeights") or {})
            default_items = {
                "Cement (OPC 53)": cement_kg,
                "Fly Ash (Class F)": flyash_kg,
                "River Sand (Zone II)": r_sand_kg,
                "Manufactured Sand (M-Sand)": m_sand_kg,
                "Aggregate 10mm": agg_10mm_kg,
                "Aggregate 20mm": agg_20mm_kg,
                "Water": water_l,
                "Admixture (PCE)": admixture_kg
            }
            for k, v in default_items.items():
                if k not in actual_dict and v > 0:
                    actual_dict[k] = v

        plant_id = getattr(trip, "plant_id", None) or (trip.po.plant_id if (trip and trip.po) else None)
        q_mat = Material.query
        if plant_id:
            q_mat = q_mat.filter((Material.plant_id == plant_id) | (Material.plant_id.is_(None)))
        materials_map = {m.name.lower(): m for m in q_mat.all()}
        stock_txs = []

        for mat_name, qty_val in actual_dict.items():
            qty = float(qty_val or 0.0)
            if qty <= 0:
                continue

            mat_key = mat_name.strip().lower()
            mat = materials_map.get(mat_key)
            if not mat:
                # Fuzzy match existing materials (e.g. "R SAND" -> "River Sand (Zone II)")
                for m_k, m_obj in materials_map.items():
                    if mat_key in m_k or m_k in mat_key or (len(mat_key) > 3 and mat_key[:4] in m_k):
                        mat = m_obj
                        break

            # If material is brand new (e.g. Admixture 2, Silica Fume), auto-register in inventory
            if not mat:
                unit_str = "l" if any(w in mat_key for w in ["water", "admix", "additive", "retarder", "diesel", "oil"]) else "kg"
                is_water_item = "water" in mat_key
                mat = Material(
                    name=mat_name.strip(),
                    unit=unit_str,
                    current_stock=0.0,
                    reorder_level=1000.0,
                    is_tracked=not is_water_item,
                    is_active=True,
                    plant_id=plant_id
                )
                db.session.add(mat)
                db.session.flush()
                materials_map[mat.name.lower()] = mat

            # Decrement stock and write ledger entry
            if getattr(mat, "is_tracked", True):
                mat.current_stock = round(mat.current_stock - qty, 2)

            tx = StockTransaction(
                material_id=mat.id,
                type="OUT",
                quantity=qty,
                reference=f"DOCKET-{docket_no}",
                note=f"SCADA Batch Docket #{docket_no} ({recipe_name}) · TM {truck_no} for {cust_name} @ {site_name}",
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
