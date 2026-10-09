from typing import Optional, Dict, Any

class ErpService:
    @staticmethod
    def sync_order(po_number: str, customer_name: str, quantity: float, grade: str) -> Dict[str, Any]:
        """
        Mock UBITECH ERP integration.
        Stores an external reference number; no external sync.
        """
        return {
            "status": "SYNCED",
            "ubitech_ref": f"UBI-{po_number}",
            "message": "Order reference synced to mock UBITECH ERP"
        }
