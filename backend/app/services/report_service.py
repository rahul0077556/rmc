import io
import csv
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Tuple
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from backend.app.models.models import (
    BatchSheet, Material, QcCheck, CubeSet, CubeTest, Challan, PurchaseOrder, Trip, Grade, Customer
)

# Registry of all 13 reports
REPORTS_REGISTRY = [
    {"key": "daily_production", "name": "1. Daily Production / Batch Report", "category": "Production"},
    {"key": "material_consumption", "name": "2. Material Consumption Report", "category": "Materials"},
    {"key": "theoretical_vs_actual", "name": "3. Theoretical vs Actual Variance by Grade", "category": "Materials"},
    {"key": "batch_sheet_register", "name": "4. Batch Sheet Register", "category": "Quality"},
    {"key": "cube_strength", "name": "5. Cube Strength Report (3/7/28-day)", "category": "Quality"},
    {"key": "cube_schedule", "name": "6. Cube Testing Schedule (Due / Overdue)", "category": "Quality"},
    {"key": "tm_qc_checks", "name": "7. TM Quality Check Report", "category": "Quality"},
    {"key": "rejected_tms", "name": "8. Rejected / Corrected TM Report", "category": "Quality"},
    {"key": "gradewise_production", "name": "9. Grade-wise Production Summary", "category": "Production"},
    {"key": "customer_supply", "name": "10. Customer-wise Supply Report", "category": "Dispatch"},
    {"key": "material_stock", "name": "11. Material Stock & Remaining Material Report", "category": "Materials"},
    {"key": "admixture_addition", "name": "12. Admixture Addition Record", "category": "Quality"},
    {"key": "challan_register", "name": "13. Delivery Challan Register", "category": "Dispatch"}
]

class ReportService:
    @staticmethod
    def get_registry() -> List[Dict[str, str]]:
        return REPORTS_REGISTRY

    @staticmethod
    def generate_report(key: str, from_date: datetime, to_date: datetime) -> Tuple[List[str], List[List[Any]]]:
        """
        Returns (columns, rows) for the requested report key within date range.
        """
        if key == "daily_production":
            cols = ["Batch No", "Trip No", "Grade", "Qty (cum)", "Batched At", "QC Status", "QC Signed By"]
            batches = (
                BatchSheet.query
                .filter(BatchSheet.batched_at >= from_date, BatchSheet.batched_at <= to_date)
                .order_by(BatchSheet.batched_at.desc())
                .all()
            )
            rows = [
                [
                    b.batch_number,
                    b.trip.trip_number if b.trip else "-",
                    b.grade.code if b.grade else "-",
                    b.quantity_cum,
                    b.batched_at.strftime("%Y-%m-%d %H:%M"),
                    b.qc_status,
                    b.qc_signed_by or "-"
                ]
                for b in batches
            ]
            return cols, rows

        elif key == "material_consumption":
            cols = ["Date", "Cement (kg)", "Sand (kg)", "Agg 10mm (kg)", "Agg 20mm (kg)", "Water (L)", "Admixture (L)"]
            batches = (
                BatchSheet.query
                .filter(BatchSheet.batched_at >= from_date, BatchSheet.batched_at <= to_date)
                .all()
            )
            # Group by day
            daily = {}
            for b in batches:
                d = b.batched_at.strftime("%Y-%m-%d")
                if d not in daily:
                    daily[d] = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
                daily[d][0] += b.cement_kg
                daily[d][1] += b.sand_kg
                daily[d][2] += b.agg_10_kg
                daily[d][3] += b.agg_20_kg
                daily[d][4] += b.water_l
                daily[d][5] += b.admixture_l

            rows = [[d] + [round(x, 1) for x in vals] for d, vals in sorted(daily.items(), reverse=True)]
            return cols, rows

        elif key == "theoretical_vs_actual":
            cols = ["Grade", "Total Batches", "Total Qty (cum)", "Theo Cement (kg)", "Actual Cement (kg)", "Variance %", "Theo Admix (L)", "Actual Admix (L)"]
            batches = (
                BatchSheet.query
                .filter(BatchSheet.batched_at >= from_date, BatchSheet.batched_at <= to_date)
                .all()
            )
            by_grade = {}
            for b in batches:
                g = b.grade.code if b.grade else "Unknown"
                if g not in by_grade:
                    by_grade[g] = {"count": 0, "qty": 0.0, "theo_cement": 0.0, "act_cement": 0.0, "theo_admix": 0.0, "act_admix": 0.0}
                by_grade[g]["count"] += 1
                by_grade[g]["qty"] += b.quantity_cum
                by_grade[g]["act_cement"] += b.cement_kg
                by_grade[g]["act_admix"] += b.admixture_l
                if b.grade and b.grade.mix_design:
                    by_grade[g]["theo_cement"] += b.grade.mix_design.cement_kg * b.quantity_cum
                    by_grade[g]["theo_admix"] += b.grade.mix_design.admixture_l * b.quantity_cum

            rows = []
            for g, data in sorted(by_grade.items()):
                theo_c = data["theo_cement"]
                act_c = data["act_cement"]
                var_c = round(((act_c - theo_c) / theo_c * 100), 2) if theo_c > 0 else 0.0
                rows.append([
                    g,
                    data["count"],
                    round(data["qty"], 1),
                    round(theo_c, 1),
                    round(act_c, 1),
                    f"{var_c:+.2f}%",
                    round(data["theo_admix"], 2),
                    round(data["act_admix"], 2)
                ])
            return cols, rows

        elif key == "batch_sheet_register":
            cols = ["Batch No", "Trip No", "Customer", "Grade", "Qty (cum)", "Operator", "Batched At", "QC Status"]
            batches = (
                BatchSheet.query
                .filter(BatchSheet.batched_at >= from_date, BatchSheet.batched_at <= to_date)
                .order_by(BatchSheet.batched_at.desc())
                .all()
            )
            rows = [
                [
                    b.batch_number,
                    b.trip.trip_number if b.trip else "-",
                    b.trip.po.customer.name if (b.trip and b.trip.po and b.trip.po.customer) else "-",
                    b.grade.code if b.grade else "-",
                    b.quantity_cum,
                    b.created_by or "AJAX System",
                    b.batched_at.strftime("%Y-%m-%d %H:%M"),
                    b.qc_status
                ]
                for b in batches
            ]
            return cols, rows

        elif key == "cube_strength":
            cols = ["Set ID", "Trip No", "Grade", "Cast Date", "Age (Days)", "Due Date", "Tested On", "Strength (MPa)", "Target (MPa)", "Result"]
            sets = CubeSet.query.all()
            rows = []
            for s in sets:
                trip = s.trip
                grade = trip.po.grade if (trip and trip.po) else None
                target_char = grade.characteristic_strength_mpa if grade else 25.0
                for t in s.tests:
                    if from_date.date() <= t.due_date <= to_date.date():
                        target = target_char if t.age_days == 28 else (target_char * 0.65 if t.age_days == 7 else target_char * 0.4)
                        rows.append([
                            s.id[:8],
                            trip.trip_number if trip else "-",
                            grade.code if grade else "-",
                            s.cast_date.isoformat(),
                            f"{t.age_days}d",
                            t.due_date.isoformat(),
                            t.tested_on.isoformat() if t.tested_on else "Pending",
                            t.strength_mpa if t.strength_mpa is not None else "-",
                            round(target, 1),
                            t.result
                        ])
            return cols, rows

        elif key == "cube_schedule":
            cols = ["Due Date", "Trip No", "Grade", "Age (Days)", "Status", "Cast Date"]
            now_date = datetime.now(timezone.utc).date()
            tests = CubeTest.query.order_by(CubeTest.due_date.asc()).all()
            rows = []
            for t in tests:
                if from_date.date() <= t.due_date <= to_date.date():
                    s = t.cube_set
                    grade = s.trip.po.grade.code if (s.trip and s.trip.po and s.trip.po.grade) else "-"
                    status = t.result
                    if status == "PENDING":
                        status = "OVERDUE" if t.due_date < now_date else "DUE"
                    rows.append([
                        t.due_date.isoformat(),
                        s.trip.trip_number if s.trip else "-",
                        grade,
                        f"{t.age_days} Days",
                        status,
                        s.cast_date.isoformat()
                    ])
            return cols, rows

        elif key == "tm_qc_checks":
            cols = ["Trip No", "Batch No", "TM No", "Slump (mm)", "Physical", "Bleeding", "Wrong Mix", "Decision", "Checked At", "Inspector"]
            checks = QcCheck.query.filter(QcCheck.checked_at >= from_date, QcCheck.checked_at <= to_date).all()
            rows = [
                [
                    c.trip.trip_number if c.trip else "-",
                    c.batch_sheet.batch_number if c.batch_sheet else "-",
                    c.trip.truck.tm_number if (c.trip and c.trip.truck) else "-",
                    c.slump_mm,
                    "PASS" if c.physical_inspection_ok else "FAIL",
                    "PASS" if c.bleeding_ok else "FAIL",
                    "PASS" if c.wrong_mix_ok else "FAIL",
                    c.decision,
                    c.checked_at.strftime("%Y-%m-%d %H:%M"),
                    c.checked_by
                ]
                for c in checks
            ]
            return cols, rows

        elif key == "rejected_tms":
            cols = ["Trip No", "TM No", "Customer", "Slump (mm)", "Action", "Remarks", "Rejected At", "Replacement Trip"]
            checks = QcCheck.query.filter(QcCheck.decision == "REJECT").all()
            rows = [
                [
                    c.trip.trip_number if c.trip else "-",
                    c.trip.truck.tm_number if (c.trip and c.trip.truck) else "-",
                    c.trip.po.customer.name if (c.trip and c.trip.po and c.trip.po.customer) else "-",
                    c.slump_mm,
                    c.reject_action or "REJECT",
                    c.remarks or "-",
                    c.checked_at.strftime("%Y-%m-%d %H:%M"),
                    c.trip.replaced_trip_id or "Auto Created"
                ]
                for c in checks
            ]
            return cols, rows

        elif key == "gradewise_production":
            cols = ["Grade Code", "Strength (MPa)", "Total Batches", "Total Qty (cum)", "Delivered Qty (cum)"]
            grades = Grade.query.all()
            rows = []
            for g in grades:
                batches = BatchSheet.query.filter_by(grade_id=g.id).all()
                total_batches = len(batches)
                total_qty = sum(b.quantity_cum for b in batches)
                deliv_qty = sum(b.trip.delivered_quantity or b.quantity_cum for b in batches if b.trip and b.trip.status == "DELIVERED")
                rows.append([
                    g.code,
                    g.characteristic_strength_mpa,
                    total_batches,
                    round(total_qty, 1),
                    round(deliv_qty, 1)
                ])
            return cols, rows

        elif key == "customer_supply":
            cols = ["Customer", "Total POs", "Ordered Qty (cum)", "Delivered Qty (cum)", "Balance Qty (cum)", "Credit Terms"]
            customers = Customer.query.all()
            rows = []
            for c in customers:
                total_pos = len(c.orders)
                ordered = sum(o.quantity_cum for o in c.orders if not o.is_deleted)
                delivered = sum(o.delivered_quantity for o in c.orders if not o.is_deleted)
                balance = max(0.0, ordered - delivered)
                rows.append([
                    c.name,
                    total_pos,
                    round(ordered, 1),
                    round(delivered, 1),
                    round(balance, 1),
                    f"{c.credit_days} Days"
                ])
            return cols, rows

        elif key == "material_stock":
            cols = ["Material", "Unit", "Current Stock", "Reorder Level", "Stock Status"]
            materials = Material.query.all()
            rows = [
                [
                    m.name,
                    m.unit,
                    round(m.current_stock, 1),
                    round(m.reorder_level, 1),
                    "CRITICAL / LOW" if m.current_stock <= m.reorder_level else "OK"
                ]
                for m in materials
            ]
            return cols, rows

        elif key == "admixture_addition":
            cols = ["Trip No", "Batch No", "Grade", "Admixture Type", "Quantity Added (L)", "Reason / Remarks", "Logged At"]
            checks = QcCheck.query.filter(QcCheck.admixture_qty > 0).all()
            rows = [
                [
                    c.trip.trip_number if c.trip else "-",
                    c.batch_sheet.batch_number if c.batch_sheet else "-",
                    c.trip.po.grade.code if (c.trip and c.trip.po and c.trip.po.grade) else "-",
                    c.admixture_type or "PCE Superplasticizer",
                    c.admixture_qty,
                    c.remarks or "Slump correction",
                    c.checked_at.strftime("%Y-%m-%d %H:%M")
                ]
                for c in checks
            ]
            return cols, rows

        elif key == "challan_register":
            cols = ["Challan No", "Trip No", "Customer", "Site", "Grade", "Qty (cum)", "TM No", "Driver", "Issued At"]
            challans = Challan.query.filter(Challan.issued_at >= from_date, Challan.issued_at <= to_date).order_by(Challan.issued_at.desc()).all()
            rows = [
                [
                    ch.challan_number,
                    ch.trip.trip_number if ch.trip else "-",
                    ch.trip.po.customer.name if (ch.trip and ch.trip.po and ch.trip.po.customer) else "-",
                    ch.trip.po.site.name if (ch.trip and ch.trip.po and ch.trip.po.site) else "-",
                    ch.trip.po.grade.code if (ch.trip and ch.trip.po and ch.trip.po.grade) else "-",
                    ch.trip.quantity_cum if ch.trip else "-",
                    ch.trip.truck.tm_number if (ch.trip and ch.trip.truck) else "-",
                    ch.trip.driver.name if (ch.trip and ch.trip.driver) else "-",
                    ch.issued_at.strftime("%Y-%m-%d %H:%M")
                ]
                for ch in challans
            ]
            return cols, rows

        else:
            return ["Info"], [["Unknown report key"]]

    @staticmethod
    def to_csv(cols: List[str], rows: List[List[Any]]) -> str:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(cols)
        for r in rows:
            writer.writerow(r)
        return output.getvalue()

    @staticmethod
    def to_excel(title: str, cols: List[str], rows: List[List[Any]]) -> bytes:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Report"

        # Title styling
        ws.merge_cells("A1:G1")
        title_cell = ws["A1"]
        title_cell.value = f"APEX RMC PLANT - {title.upper()}"
        title_cell.font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
        title_cell.fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
        title_cell.alignment = Alignment(horizontal="center", vertical="middle")

        # Headers
        header_fill = PatternFill(start_color="3B82F6", end_color="3B82F6", fill_type="solid")
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        thin_border = Border(
            left=Side(style='thin', color='CBD5E1'),
            right=Side(style='thin', color='CBD5E1'),
            top=Side(style='thin', color='CBD5E1'),
            bottom=Side(style='thin', color='CBD5E1')
        )

        for col_idx, col_name in enumerate(cols, 1):
            cell = ws.cell(row=3, column=col_idx, value=col_name)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center", vertical="middle")
            cell.border = thin_border

        # Data rows
        for row_idx, r_data in enumerate(rows, 4):
            for col_idx, val in enumerate(r_data, 1):
                cell = ws.cell(row=row_idx, column=col_idx, value=val)
                cell.font = Font(name="Calibri", size=10)
                cell.border = thin_border
                if isinstance(val, (int, float)):
                    cell.alignment = Alignment(horizontal="right")
                else:
                    cell.alignment = Alignment(horizontal="left")

        # Adjust column widths
        for col in ws.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = openpyxl.utils.get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output.getvalue()
