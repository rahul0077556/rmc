import random
from typing import Dict, Any, List, Tuple
from backend.app.extensions import db
from backend.app.models.models import Material, MixDesign, StockTransaction

class BatchingPlantService:
    @staticmethod
    def calculate_required_materials(mix: MixDesign, quantity_cum: float) -> Dict[str, float]:
        """
        Calculate required theoretical material quantities for a given batch quantity.
        """
        return {
            "Cement (OPC 53)": round(mix.cement_kg * quantity_cum, 2),
            "River Sand (Zone II)": round(mix.sand_kg * quantity_cum, 2),
            "Aggregate 10mm": round(mix.aggregate_10mm_kg * quantity_cum, 2),
            "Aggregate 20mm": round(mix.aggregate_20mm_kg * quantity_cum, 2),
            "Water": round(mix.water_l * quantity_cum, 2),
            "Admixture (PCE)": round(mix.admixture_l * quantity_cum, 2)
        }

    @staticmethod
    def check_material_shortfalls(mix: MixDesign, quantity_cum: float) -> List[Dict[str, Any]]:
        """
        Check if current stock satisfies required materials.
        Returns a list of shortfalls (empty if all sufficient).
        """
        required = BatchingPlantService.calculate_required_materials(mix, quantity_cum)
        shortfalls = []
        
        materials = {m.name: m for m in Material.query.all()}
        for mat_name, req_qty in required.items():
            mat = materials.get(mat_name)
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
    def decrement_stock_for_batch(batch_number: str, actual_weights: Dict[str, float], user_id: str):
        """
        Decrement material stock based on weighed batch sheet quantities and record transactions.
        """
        materials = {m.name: m for m in Material.query.all()}
        for mat_name, used_qty in actual_weights.items():
            mat = materials.get(mat_name)
            if mat:
                mat.current_stock = max(0.0, mat.current_stock - used_qty)
                tx = StockTransaction(
                    material_id=mat.id,
                    type="OUT",
                    quantity=used_qty,
                    reference=f"Batch {batch_number}",
                    note=f"Automatic batching consumption for {batch_number}",
                    created_by=user_id
                )
                db.session.add(tx)
        db.session.flush()
