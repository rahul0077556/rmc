import { addDays, format } from "date-fns";
import { respond, fail } from "./client";
import { db, recordAudit } from "@/lib/store";
import type { ApiResponse, Invoice, Payment } from "@/types";

export interface InvoiceRow extends Invoice {
  customerName: string;
  outstanding: number;
}

function decorate(inv: Invoice): InvoiceRow {
  return {
    ...inv,
    customerName: db.customers.find((c) => c.id === inv.customerId)?.name ?? "—",
    outstanding: inv.amount - inv.paid,
  };
}

export const invoicesApi = {
  list(customerId?: string): Promise<ApiResponse<InvoiceRow[]>> {
    let rows = [...db.invoices].sort((a, b) => b.issueDate.localeCompare(a.issueDate));
    if (customerId) rows = rows.filter((i) => i.customerId === customerId);
    return respond(rows.map(decorate));
  },

  get(id: string): Promise<ApiResponse<InvoiceRow | null>> {
    const inv = db.invoices.find((i) => i.id === id);
    return respond(inv ? decorate(inv) : null);
  },

  summary(customerId?: string): Promise<
    ApiResponse<{ invoiced: number; received: number; outstanding: number; overdue: number }>
  > {
    const rows = customerId ? db.invoices.filter((i) => i.customerId === customerId) : db.invoices;
    const invoiced = rows.reduce((s, i) => s + i.amount, 0);
    const received = rows.reduce((s, i) => s + i.paid, 0);
    return respond({
      invoiced,
      received,
      outstanding: invoiced - received,
      overdue: rows.filter((i) => i.status === "OVERDUE").reduce((s, i) => s + (i.amount - i.paid), 0),
    });
  },

  createFromPo(poId: string, actor: string): Promise<ApiResponse<InvoiceRow>> {
    const po = db.purchaseOrders.find((p) => p.id === poId)!;
    const deliveredTrips = db.trips.filter((t) => t.poId === poId && t.status === "DELIVERED");
    const qty = deliveredTrips.reduce((s, t) => s + (t.deliveredQuantity ?? t.quantity), 0);
    const amount = Math.round(qty * po.ratePerCum * 1.18);
    const customer = db.customers.find((c) => c.id === po.customerId)!;
    const invoiceNumber = `INV-2026-${String(db.invoices.length + 1).padStart(4, "0")}`;
    const invoice: Invoice = {
      id: invoiceNumber,
      invoiceNumber,
      poId,
      customerId: po.customerId,
      issueDate: format(new Date(), "yyyy-MM-dd"),
      dueDate: format(addDays(new Date(), customer.creditDays), "yyyy-MM-dd"),
      amount,
      paid: 0,
      status: "ISSUED",
      tripIds: deliveredTrips.map((t) => t.id),
    };
    db.invoices.unshift(invoice);
    recordAudit(actor, `created ${invoiceNumber} for ${po.poNumber}`, invoiceNumber);
    return respond(decorate(invoice), "Invoice created");
  },

  recordPayment(
    invoiceId: string,
    input: { amount: number; paidDate: string; mode: Payment["mode"]; reference: string },
    actor: string,
  ): Promise<ApiResponse<InvoiceRow>> {
    const invoice = db.invoices.find((i) => i.id === invoiceId);
    if (!invoice) return fail<InvoiceRow>(404, "Invoice not found");
    const outstanding = invoice.amount - invoice.paid;
    if (input.amount > outstanding) {
      return fail<InvoiceRow>(400, "Payment cannot exceed the outstanding amount");
    }
    invoice.paid += input.amount;
    invoice.status = invoice.paid >= invoice.amount ? "PAID" : "PARTIALLY_PAID";
    db.payments.unshift({ id: `PAY-${Date.now()}`, invoiceId, ...input });
    recordAudit(actor, `recorded payment on ${invoice.invoiceNumber}`, invoice.invoiceNumber);
    return respond(decorate(invoice), "Payment recorded");
  },

  payments(invoiceId: string): Promise<ApiResponse<Payment[]>> {
    return respond(db.payments.filter((p) => p.invoiceId === invoiceId));
  },
};
