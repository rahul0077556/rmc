import { request } from "./client";
import type { ApiResponse, Grade, PurchaseOrder, PoStatus } from "@/types";

export interface OrderRow extends PurchaseOrder {
  customerName: string;
  siteName: string;
  siteAddress?: string;
  balanceQuantity?: number;
  approvalRemarks?: string;
  cancelReason?: string;
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

function decorate(po: any): OrderRow {
  return {
    id: po.id,
    poNumber: po.poNumber || po.id,
    customerId: po.customerId,
    customerName: po.customerName || "—",
    siteId: po.siteId,
    siteName: po.siteName || "—",
    siteAddress: po.siteAddress,
    grade: po.grade || "M25",
    quantity: po.quantity ?? po.quantity_cum ?? 0,
    deliveredQuantity: po.deliveredQuantity ?? 0,
    balanceQuantity: po.balanceQuantity ?? 0,
    ratePerCum: po.ratePerCum ?? 0,
    deliveryDate: po.deliveryDate || (po.deliveryDateTime ? po.deliveryDateTime.slice(0, 10) : ""),
    deliveryTime: po.deliveryTime || (po.deliveryDateTime ? po.deliveryDateTime.slice(11, 16) : "09:00"),
    purpose: po.purpose || "Slab",
    pumpRequired: Boolean(po.pumpRequired),
    pumpOwnership: po.pumpOwnership,
    pumpType: po.pumpType,
    pipelineLength: po.pipelineLength,
    workersRequired: po.workersRequired,
    paymentTerms: po.paymentTerms || `${po.paymentTermsDays || 30} Days`,
    reference: po.reference || "",
    notes: po.notes || "",
    status: po.status as PoStatus,
    tripCount: po.tripCount ?? 0,
    createdBy: po.createdBy,
    createdAt: po.createdAt || new Date().toISOString(),
    submittedAt: po.submittedAt,
    approvedAt: po.approvedAt,
    approvedBy: po.approvedBy,
    approvalRemarks: po.approvalRemarks,
    rejectionReason: po.rejectionReason,
    cancelReason: po.cancelReason,
  };
}

export const ordersApi = {
  async list(filter?: { customerId?: string; status?: PoStatus }): Promise<ApiResponse<OrderRow[]>> {
    try {
      const params = new URLSearchParams();
      if (filter?.customerId) params.append("customerId", filter.customerId);
      if (filter?.status) params.append("status", filter.status);

      const res = await request<any[]>({ url: `/purchase-orders?${params.toString()}`, method: "GET" });
      const rows = res.data || [];
      return { data: rows.map(decorate) };
    } catch {
      return { data: [] };
    }
  },

  async get(id: string): Promise<ApiResponse<OrderRow | null>> {
    const res = await request<any>({ url: `/purchase-orders/${id}`, method: "GET" });
    return { data: res.data ? decorate(res.data) : null };
  },

  async approvalQueue(): Promise<ApiResponse<OrderRow[]>> {
    try {
      const res = await request<any[]>({ url: `/purchase-orders?status=SUBMITTED`, method: "GET" });
      const rows = res.data || [];
      return { data: rows.map(decorate) };
    } catch {
      return { data: [] };
    }
  },

  async create(input: CreateOrderInput, _createdBy?: string): Promise<ApiResponse<OrderRow>> {
    const res = await request<any>({
      url: "/purchase-orders",
      method: "POST",
      data: {
        customerId: input.customerId,
        siteId: input.siteId,
        grade: input.grade,
        quantity: input.quantity,
        ratePerCum: input.ratePerCum,
        deliveryDate: input.deliveryDate,
        deliveryTime: input.deliveryTime,
        purpose: input.purpose,
        pumpRequired: input.pumpRequired,
        pumpOwnership: input.pumpOwnership,
        pumpType: input.pumpType,
        pipelineLength: input.pipelineLength,
        workersRequired: input.workersRequired,
        paymentTermsDays: parseInt(input.paymentTerms.replace(/\D/g, "") || "30", 10),
        notes: input.notes,
      },
    });

    let po = res.data;
    if (input.status === "SUBMITTED" && po?.id) {
      const submitRes = await request<any>({
        url: `/purchase-orders/${po.id}/submit`,
        method: "POST",
      });
      if (submitRes.data) po = submitRes.data;
    }

    return {
      data: decorate(po),
      message: input.status === "DRAFT" ? "PO saved as draft in database" : "PO submitted successfully to database",
    };
  },

  async submit(id: string, _actor?: string): Promise<ApiResponse<OrderRow | null>> {
    const res = await request<any>({ url: `/purchase-orders/${id}/submit`, method: "POST" });
    return { data: res.data ? decorate(res.data) : null, message: "PO submitted successfully in database" };
  },

  async approve(id: string, _actor?: string): Promise<ApiResponse<OrderRow | null>> {
    const res = await request<any>({
      url: `/purchase-orders/${id}/approve`,
      method: "POST",
      data: { remarks: "Approved by manager" },
    });
    return { data: res.data ? decorate(res.data) : null, message: "PO approved and sent to Dispatch" };
  },

  async reject(id: string, reason: string, _actor?: string): Promise<ApiResponse<OrderRow | null>> {
    const res = await request<any>({
      url: `/purchase-orders/${id}/reject`,
      method: "POST",
      data: { reason },
    });
    return { data: res.data ? decorate(res.data) : null, message: "PO rejected in database" };
  },

  async remove(id: string): Promise<ApiResponse<null>> {
    await request<null>({
      url: `/purchase-orders/${id}/cancel`,
      method: "POST",
      data: { reason: "User cancelled" },
    });
    return { data: null, message: "PO cancelled in database" };
  },
};
