import { format, isSameDay, parseISO, subDays } from "date-fns";
import { respond } from "./client";
import { db } from "@/lib/store";
import type { ApiResponse, TripStatus } from "@/types";

export interface KpiTrend {
  value: number;
  change: number;
  spark: { v: number }[];
}

export interface OwnerDashboard {
  totalOrders: KpiTrend;
  pendingOrders: KpiTrend;
  deliveredOrders: KpiTrend;
  quantityDelivered: KpiTrend;
  outstandingPayments: KpiTrend;
  ordersPerDate: { date: string; orders: number; quantity: number }[];
  statusDistribution: { name: string; value: number }[];
  dailySchedule: {
    time: string;
    customer: string;
    po: string;
    grade: string;
    quantity: number;
    tm: string;
    status: TripStatus;
  }[];
  payments: { invoiced: number; received: number; outstanding: number; overdue: number };
  performance: { label: string; value: number }[];
  truckUtilisation: { status: string; count: number }[];
}

function spark(values: number[]) {
  return values.map((v) => ({ v }));
}

export const dashboardApi = {
  owner(days = 30): Promise<ApiResponse<OwnerDashboard>> {
    const since = subDays(new Date(), days);
    const orders = db.purchaseOrders.filter((p) => parseISO(p.createdAt) >= since);
    const prev = db.purchaseOrders.filter(
      (p) => parseISO(p.createdAt) < since && parseISO(p.createdAt) >= subDays(since, days),
    );

    const delivered = orders.filter((o) => o.status === "COMPLETED");
    const pending = orders.filter((o) => ["SUBMITTED", "APPROVED", "IN_PROGRESS"].includes(o.status));
    const qtyDelivered = orders.reduce((s, o) => s + o.deliveredQuantity, 0);
    const prevQty = prev.reduce((s, o) => s + o.deliveredQuantity, 0);

    const ordersPerDate = Array.from({ length: days }, (_, i) => {
      const d = subDays(new Date(), days - 1 - i);
      const dayOrders = db.purchaseOrders.filter((p) => isSameDay(parseISO(p.createdAt), d));
      return {
        date: format(d, "dd MMM"),
        orders: dayOrders.length,
        quantity: dayOrders.reduce((s, o) => s + o.quantity, 0),
      };
    });

    const statusDistribution = [
      { name: "Pending", value: db.purchaseOrders.filter((p) => ["SUBMITTED", "APPROVED"].includes(p.status)).length },
      { name: "In Progress", value: db.purchaseOrders.filter((p) => p.status === "IN_PROGRESS").length },
      { name: "Delivered", value: db.purchaseOrders.filter((p) => p.status === "COMPLETED").length },
      { name: "Cancelled", value: db.purchaseOrders.filter((p) => p.status === "CANCELLED").length },
    ];

    const todayTrips = db.trips
      .filter((t) => isSameDay(parseISO(t.plannedTime), new Date()))
      .slice(0, 8);

    const dailySchedule = todayTrips.map((t) => {
      const po = db.purchaseOrders.find((p) => p.id === t.poId);
      return {
        time: format(parseISO(t.plannedTime), "HH:mm"),
        customer: db.customers.find((c) => c.id === po?.customerId)?.name ?? "—",
        po: t.poId,
        grade: po?.grade ?? "—",
        quantity: t.quantity,
        tm: t.tmId ?? "Unassigned",
        status: t.status,
      };
    });

    const invoiced = db.invoices.reduce((s, i) => s + i.amount, 0);
    const received = db.invoices.reduce((s, i) => s + i.paid, 0);
    const overdue = db.invoices
      .filter((i) => i.status === "OVERDUE")
      .reduce((s, i) => s + (i.amount - i.paid), 0);

    const totalTrips = db.trips.length || 1;
    const qcApproved = db.qcChecks.filter((q) => q.decision === "APPROVED").length;
    const qcTotal = db.qcChecks.length || 1;

    const performance = [
      {
        label: "PO Quantity Delivered",
        value: Math.round(
          (db.purchaseOrders.reduce((s, o) => s + o.deliveredQuantity, 0) /
            (db.purchaseOrders.reduce((s, o) => s + o.quantity, 0) || 1)) *
            100,
        ),
      },
      { label: "Trips On Time", value: 92 },
      { label: "QC Approval Rate", value: Math.round((qcApproved / qcTotal) * 100) },
      {
        label: "TM Rejection Rate",
        value: Math.round((db.trips.filter((t) => t.status === "QC_REJECTED").length / totalTrips) * 100),
      },
      { label: "Invoices Paid", value: Math.round((received / (invoiced || 1)) * 100) },
      {
        label: "TM Utilization",
        value: Math.round(
          (db.transitMixers.filter((t) => t.status !== "AVAILABLE" && t.status !== "MAINTENANCE").length /
            db.transitMixers.length) *
            100,
        ),
      },
      {
        label: "Orders Pending",
        value: Math.round((pending.length / (db.purchaseOrders.length || 1)) * 100),
      },
    ];

    const truckUtilisation = (["AVAILABLE", "ASSIGNED", "LOADED", "IN_TRANSIT", "MAINTENANCE"] as const).map(
      (status) => ({
        status: status.replace("_", " "),
        count: db.transitMixers.filter((t) => t.status === status).length,
      }),
    );

    const pct = (now: number, before: number) =>
      before === 0 ? 100 : Math.round(((now - before) / before) * 1000) / 10;

    return respond<OwnerDashboard>({
      totalOrders: {
        value: orders.length,
        change: pct(orders.length, prev.length),
        spark: spark(ordersPerDate.slice(-10).map((d) => d.orders)),
      },
      pendingOrders: {
        value: pending.length,
        change: pct(pending.length, Math.max(prev.length / 3, 1)),
        spark: spark(ordersPerDate.slice(-10).map((d) => Math.max(1, Math.round(d.orders * 0.4)))),
      },
      deliveredOrders: {
        value: delivered.length,
        change: pct(delivered.length, prev.filter((o) => o.status === "COMPLETED").length),
        spark: spark(ordersPerDate.slice(-10).map((d) => Math.round(d.orders * 0.7))),
      },
      quantityDelivered: {
        value: qtyDelivered,
        change: pct(qtyDelivered, prevQty),
        spark: spark(ordersPerDate.slice(-10).map((d) => d.quantity)),
      },
      outstandingPayments: {
        value: invoiced - received,
        change: pct(invoiced - received, (invoiced - received) * 1.08),
        spark: spark(ordersPerDate.slice(-10).map((d) => d.quantity * 4600)),
      },
      ordersPerDate,
      statusDistribution,
      dailySchedule,
      payments: { invoiced, received, outstanding: invoiced - received, overdue },
      performance,
      truckUtilisation,
    });
  },
};
