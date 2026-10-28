import { request } from "./client";
import type { ApiResponse, Invoice, InvoiceStatus, Payment } from "@/types";

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  tripId: string;
  tripNumber?: string;
  challanNumber?: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface InvoiceRow extends Invoice {
  poNumber?: string;
  customerName: string;
  subtotal: number;
  gstPercent: number;
  gstAmount: number;
  tripCount: number;
  totalQuantity: number;
  outstanding: number;
  lines?: InvoiceLineItem[];
  paymentsList?: Payment[];
}

function decorate(inv: any): InvoiceRow {
  const total = inv.total ?? inv.amount ?? 0;
  const subtotal = inv.subtotal ?? (inv.lines ? inv.lines.reduce((s: number, l: any) => s + (l.amount || 0), 0) : total / 1.18);
  const gstPercent = inv.gstPercent ?? inv.gst_percent ?? 18.0;
  const gstAmount = inv.gstAmount ?? Math.max(0, Math.round((total - subtotal) * 100) / 100);
  const paid = inv.paidAmount ?? inv.paid ?? 0;
  const outstanding = inv.outstandingAmount ?? Math.max(0, Math.round((total - paid) * 100) / 100);

  const lines: InvoiceLineItem[] = (inv.lines || []).map((l: any) => ({
    id: l.id,
    invoiceId: l.invoiceId || inv.id,
    tripId: l.tripId || l.trip_id,
    tripNumber: l.tripNumber || l.trip_number || "Trip",
    challanNumber: l.challanNumber || l.challan_number || "—",
    quantity: l.quantity || 0,
    rate: l.rate || 0,
    amount: l.amount || 0,
  }));

  const tripIds = lines.length > 0 ? lines.map((l) => l.tripId) : (inv.tripIds || []);
  const tripCount = inv.tripCount ?? (lines.length > 0 ? lines.length : (tripIds.length || 1));
  const totalQuantity = inv.totalQuantity ?? (lines.length > 0 ? lines.reduce((s, l) => s + l.quantity, 0) : 0);

  const paymentsList = (inv.payments || []).map((p: any) => ({
    id: p.id,
    invoiceId: p.invoiceId || inv.id,
    amount: p.amount,
    paidDate: p.paidOn || p.paidDate || p.createdAt?.slice(0, 10),
    mode: p.mode || "NEFT",
    reference: p.reference || "",
  }));

  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber || inv.invoice_number || inv.id,
    poId: inv.poId || inv.po_id,
    poNumber: inv.poNumber || inv.po_number || inv.poId,
    customerId: inv.customerId || inv.customer_id,
    customerName: inv.customerName || inv.customer_name || "—",
    issueDate: inv.issueDate || inv.issue_date,
    dueDate: inv.dueDate || inv.due_date,
    subtotal: Math.round(subtotal * 100) / 100,
    gstPercent,
    gstAmount,
    amount: total,
    paid: paid,
    outstanding: outstanding,
    status: (inv.status || "ISSUED") as InvoiceStatus,
    tripCount,
    totalQuantity: Math.round(totalQuantity * 100) / 100,
    tripIds: tripIds,
    lines,
    paymentsList,
  };
}

export const invoicesApi = {
  async list(customerId?: string): Promise<ApiResponse<InvoiceRow[]>> {
    const url = customerId ? `/invoices?customerId=${customerId}` : "/invoices";
    const res = await request<any[]>({ url, method: "GET" });
    const rows = (res.data || []).map(decorate);
    return { data: rows.sort((a, b) => b.issueDate.localeCompare(a.issueDate)) };
  },

  async get(id: string): Promise<ApiResponse<InvoiceRow | null>> {
    const res = await request<any>({ url: `/invoices/${id}`, method: "GET" });
    return { data: res.data ? decorate(res.data) : null };
  },

  async summary(customerId?: string): Promise<
    ApiResponse<{ invoiced: number; received: number; outstanding: number; overdue: number }>
  > {
    const res = await this.list(customerId);
    const rows = res.data || [];
    const invoiced = rows.reduce((s, i) => s + i.amount, 0);
    const received = rows.reduce((s, i) => s + i.paid, 0);
    const overdue = rows.filter((i) => i.status === "OVERDUE").reduce((s, i) => s + i.outstanding, 0);

    return {
      data: {
        invoiced,
        received,
        outstanding: invoiced - received,
        overdue,
      },
    };
  },

  async createFromPo(poId: string, _actor?: string): Promise<ApiResponse<InvoiceRow>> {
    const res = await request<any>({
      url: "/invoices",
      method: "POST",
      data: { poId },
    });
    return { data: decorate(res.data), message: "Invoice created from delivered trips" };
  },

  async recordPayment(
    invoiceId: string,
    input: { amount: number; paidDate: string; mode: Payment["mode"]; reference: string },
    _actor?: string,
  ): Promise<ApiResponse<InvoiceRow>> {
    const res = await request<any>({
      url: `/invoices/${invoiceId}/payments`,
      method: "POST",
      data: {
        amount: input.amount,
        paidOn: input.paidDate,
        mode: input.mode,
        reference: input.reference,
      },
    });
    return { data: decorate(res.data), message: "Payment recorded successfully" };
  },

  async payments(invoiceId: string): Promise<ApiResponse<Payment[]>> {
    const res = await this.get(invoiceId);
    return { data: res.data?.paymentsList || [] };
  },

  async syncAll(): Promise<ApiResponse<InvoiceRow[]>> {
    const res = await request<any[]>({ url: "/invoices/sync-all", method: "POST" });
    const rows = (res.data || []).map(decorate);
    return { data: rows, message: "Invoices synced across all delivered concrete trips" };
  },
};

