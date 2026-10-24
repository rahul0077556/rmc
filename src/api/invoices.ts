import { request } from "./client";
import type { ApiResponse, Invoice, InvoiceStatus, Payment } from "@/types";

export interface InvoiceRow extends Invoice {
  customerName: string;
  outstanding: number;
  paymentsList?: Payment[];
}

function decorate(inv: any): InvoiceRow {
  const total = inv.total ?? inv.amount ?? 0;
  const paid = inv.paidAmount ?? inv.paid ?? 0;
  const outstanding = inv.outstandingAmount ?? Math.max(0, total - paid);
  const tripIds = inv.lines ? inv.lines.map((l: any) => l.tripId || l.id) : (inv.tripIds || []);
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
    customerId: inv.customerId || inv.customer_id,
    customerName: inv.customerName || inv.customer_name || "—",
    issueDate: inv.issueDate || inv.issue_date,
    dueDate: inv.dueDate || inv.due_date,
    amount: total,
    paid: paid,
    outstanding: outstanding,
    status: (inv.status || "ISSUED") as InvoiceStatus,
    tripIds: tripIds,
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
};

