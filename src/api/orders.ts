import { respond } from "./client";
import { db, poById, recordAudit } from "@/lib/store";
import { GRADE_RATE } from "@/lib/mock-data";
import type { ApiResponse, Grade, PurchaseOrder, PoStatus } from "@/types";

export interface OrderRow extends PurchaseOrder {
  customerName: string;
  siteName: string;
  tripCount: number;
}

export interface CreateOrderInput {
  customerId: string;
  siteId: string;
  grade: Grade;
  quantity: number;
  ratePerCum: number;
  deliveryDate: string;
  deliveryTime: string;
  purpose: PurchaseOrder["purpose"];
  pumpRequired: boolean;
  pumpOwnership?: PurchaseOrder["pumpOwnership"];
  pumpType?: PurchaseOrder["pumpType"];
  pipelineLength?: number;
  workersRequired?: number;
  paymentTerms: string;
  reference: string;
  notes: string;
  status: Extract<PoStatus, "DRAFT" | "SUBMITTED">;
}

function decorate(po: PurchaseOrder): OrderRow {
  return {
    ...po,
    customerName: db.customers.find((c) => c.id === po.customerId)?.name ?? "—",
    siteName: db.sites.find((s) => s.id === po.siteId)?.name ?? "—",
    tripCount: db.trips.filter((t) => t.poId === po.id).length,
  };
}

export const ordersApi = {
  list(filter?: { customerId?: string; status?: PoStatus }): Promise<ApiResponse<OrderRow[]>> {
    let rows = [...db.purchaseOrders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filter?.customerId) rows = rows.filter((r) => r.customerId === filter.customerId);
    if (filter?.status) rows = rows.filter((r) => r.status === filter.status);
    return respond(rows.map(decorate));
  },

  get(id: string): Promise<ApiResponse<OrderRow | null>> {
    const po = poById(id);
    return respond(po ? decorate(po) : null);
  },

  approvalQueue(): Promise<ApiResponse<OrderRow[]>> {
    return respond(db.purchaseOrders.filter((p) => p.status === "SUBMITTED").map(decorate));
  },

  create(input: CreateOrderInput, createdBy: string): Promise<ApiResponse<OrderRow>> {
    const seq = db.purchaseOrders.length + 1;
    const po: PurchaseOrder = {
      ...input,
      id: `PO-2026-${String(seq).padStart(4, "0")}`,
      poNumber: `PO-2026-${String(seq).padStart(4, "0")}`,
      ratePerCum: input.ratePerCum || GRADE_RATE[input.grade],
      deliveredQuantity: 0,
      createdBy,
      createdAt: new Date().toISOString(),
      submittedAt: input.status === "SUBMITTED" ? new Date().toISOString() : undefined,
    };
    db.purchaseOrders.unshift(po);
    recordAudit(createdBy, `created ${po.poNumber}`, po.poNumber);
    return respond(decorate(po), input.status === "DRAFT" ? "PO saved as draft" : "PO submitted successfully");
  },

  submit(id: string, actor: string): Promise<ApiResponse<OrderRow | null>> {
    const po = poById(id);
    if (po) {
      po.status = "SUBMITTED";
      po.submittedAt = new Date().toISOString();
      recordAudit(actor, `submitted ${po.poNumber}`, po.poNumber);
    }
    return respond(po ? decorate(po) : null, "PO submitted successfully");
  },

  approve(id: string, actor: string): Promise<ApiResponse<OrderRow | null>> {
    const po = poById(id);
    if (po) {
      po.status = "APPROVED";
      po.approvedAt = new Date().toISOString();
      po.approvedBy = actor;
      recordAudit(actor, `approved ${po.poNumber}`, po.poNumber);
    }
    return respond(po ? decorate(po) : null, "PO approved and sent to Dispatch");
  },

  reject(id: string, reason: string, actor: string): Promise<ApiResponse<OrderRow | null>> {
    const po = poById(id);
    if (po) {
      po.status = "REJECTED";
      po.rejectionReason = reason;
      recordAudit(actor, `rejected ${po.poNumber}`, po.poNumber);
    }
    return respond(po ? decorate(po) : null, "PO rejected");
  },

  remove(id: string): Promise<ApiResponse<null>> {
    const idx = db.purchaseOrders.findIndex((p) => p.id === id);
    if (idx >= 0) db.purchaseOrders.splice(idx, 1);
    return respond(null, "Draft PO deleted");
  },
};
