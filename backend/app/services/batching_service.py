import random
from typing import Dict, Any, List, Tuple
from backend.app.extensions import db
from backend.app.models.models import Material, MixDesign, StockTransaction

class BatchingPlantService:
    @staticmethod
    def calculate_required_materials(mix: MixDesign, quantity_cum: float) -> Dict[str, float]:
        """
        Calculate required theoretical material quantities for a given batch quantity.
        Supports dynamic materials from the mix design (Fly Ash, M-Sand, GGBS, Admixture).
        """
        req = {
            "Cement (OPC 53)": round(mix.cement_kg * quantity_cum, 2),
            "River Sand (Zone II)": round(mix.sand_kg * quantity_cum, 2),
            "Aggregate 10mm": round(mix.aggregate_10mm_kg * quantity_cum, 2),
            "Aggregate 20mm": round(mix.aggregate_20mm_kg * quantity_cum, 2),
            "Water": round(mix.water_l * quantity_cum, 2),
            "Admixture (PCE)": round(mix.admixture_l * quantity_cum, 2)
        }
        if getattr(mix, "flyash_kg", 0.0) and mix.flyash_kg > 0:
            req["Fly Ash (Class F)"] = round(mix.flyash_kg * quantity_cum, 2)
        if getattr(mix, "m_sand_kg", 0.0) and mix.m_sand_kg > 0:
            req["Manufactured Sand (M-Sand)"] = round(mix.m_sand_kg * quantity_cum, 2)
        if getattr(mix, "ggbs_kg", 0.0) and mix.ggbs_kg > 0:
            req["GGBS (Slag)"] = round(mix.ggbs_kg * quantity_cum, 2)
        return req

    @staticmethod
    def check_material_shortfalls(mix: MixDesign, quantity_cum: float) -> List[Dict[str, Any]]:
        """
        Check if current stock satisfies required materials.
        Water is consumption only, not a stocked item, so it never has shortfalls.
        """
        required = BatchingPlantService.calculate_required_materials(mix, quantity_cum)
        shortfalls = []
        
        materials = {m.name: m for m in Material.query.all()}
        for mat_name, req_qty in required.items():
            # Water is consumption-only: never report shortfall
            if "water" in mat_name.lower():
                continue
            mat = materials.get(mat_name)
            if mat and not getattr(mat, "is_tracked", True):
                continue
            curr_stock = mat.current_stock if mat else 0.0
            if curr_stock < req_qty:
                shortfalls.append({
                    "material": mat_name,
                    "unit": mat.unit if mat else "kg",
                    "required": req_qty,
                    "available": curr_stock,
                    "shortfall": round(req_qty - curr_stock, 2)
                })
        return shortfalls

    @staticmethod
    def simulate_actual_weights(mix: MixDesign, quantity_cum: float, variance_pct: float = 0.015) -> Dict[str, float]:
        """
        Simulate automatic AJAX batching scale weighing with small realistic random variance (+/- 1-2%).
        """
        required = BatchingPlantService.calculate_required_materials(mix, quantity_cum)
        actuals = {}
        for mat_name, req_val in required.items():
            # Random factor between (1 - variance_pct) and (1 + variance_pct)
            factor = 1.0 + random.uniform(-variance_pct, variance_pct)
            if mat_name == "Admixture (PCE)":
                actuals[mat_name] = round(req_val * factor, 2)
            else:
                actuals[mat_name] = round(req_val * factor, 1)
        return actuals

    @staticmethod
    def decrement_stock_for_batch(batch_number: str, actual_weights: Dict[str, float], user_id: str, note: str = None):
        """
        Decrement material stock based on weighed batch sheet quantities and record transactions.
        Golden rule: stock is never clamped to zero; negative balances reflect unrecorded receipts to be reconciled.
        Water is consumption only.
        """
        materials = {m.name: m for m in Material.query.all()}
        tx_note = note or f"Automatic batching consumption for {batch_number}"
        for mat_name, used_qty in actual_weights.items():
            mat = materials.get(mat_name)
            if not mat:
                # Try partial match
                for m_name, m_obj in materials.items():
                    if mat_name.split()[0].lower() in m_name.lower():
                        mat = m_obj
                        break
            if mat:
                # Deduct stock if tracked (Water is not tracked as inventory stock)
                if getattr(mat, "is_tracked", True):
                    mat.current_stock = round(mat.current_stock - used_qty, 2)
                tx = StockTransaction(
                    material_id=mat.id,
                    type="OUT",
                    quantity=used_qty,
                    reference=f"Batch {batch_number}",
                    note=tx_note,
                    created_by=user_id
                )
                db.session.add(tx)
        db.session.flush()
