import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Boxes, FileText, PackageCheck, Timer } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { ChartCard } from "@/components/app/chart-card";
import { DataTable, type Column } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { Stepper } from "@/components/app/stepper";
import { LoadingState, ErrorState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ordersApi, type OrderRow } from "@/api/orders";
import { tripsApi, type TripRow } from "@/api/trips";
import { invoicesApi } from "@/api/invoices";
import { useAuth } from "@/auth/auth-context";
import { cum, dt, inr, timeOnly } from "@/lib/format";
import { ConcreteClock } from "@/components/common/ConcreteClock";

export const Route = createFileRoute("/_shell/portal")({
  head: () => ({
    meta: [
      { title: "My Orders · RMC Command Center" },
      { name: "description", content: "Track your concrete orders, live trip stages and delivery challans." },
      { property: "og:title", content: "My Orders · RMC Command Center" },
      { property: "og:description", content: "Track your concrete orders, live trip stages and delivery challans." },
    ],
  }),
  component: PortalPage,
});

const STAGES = [
  "Order Approved",
  "Scheduled",
  "Batching",
  "Quality Check",
  "Dispatched",
  "In Transit",
  "Delivered",
];

function stageIndex(status: TripRow["status"]): number {
  switch (status) {
    case "PLANNED":
      return 1;
    case "SENT_TO_PRODUCTION":
    case "BATCHING":
    case "LOADED":
      return 2;
    case "QC_PENDING":
    case "QC_REJECTED":
    case "CORRECTING":
    case "QC_APPROVED":
      return 3;
    case "DISPATCHED":
      return 4;
    case "IN_TRANSIT":
      return 5;
    case "DELIVERED":
      return 6;
    default:
      return 0;
  }
}

function PortalPage() {
  const { user } = useAuth();
  const customerId = user?.customerId ?? "";
  const [selected, setSelected] = useState<OrderRow | null>(null);

  const orders = useQuery({
    queryKey: ["orders", customerId],
    queryFn: () => ordersApi.list({ customerId }).then((r) => r.data),
  });
  const trips = useQuery({
    queryKey: ["trips", selected?.id],
    queryFn: () => tripsApi.list({ poId: selected!.id }).then((r) => r.data),
    enabled: selected !== null,
  });
  const invoices = useQuery({
    queryKey: ["invoices", customerId],
    queryFn: () => invoicesApi.list(customerId).then((r) => r.data),
  });

  if (orders.isLoading) return <LoadingState rows={5} />;
  if (orders.error || !orders.data) return <ErrorState message="Your orders could not be loaded." onRetry={() => void orders.refetch()} />;

  const rows = orders.data;
  const outstanding = (invoices.data ?? []).filter((i) => i.outstanding > 0);

  const orderColumns: Column<OrderRow>[] = [
    { key: "po", header: "PO Number", cell: (r) => <span className="font-medium">{r.poNumber}</span> },
    { key: "site", header: "Site", cell: (r) => r.siteName },
    { key: "grade", header: "Grade", cell: (r) => r.grade },
    { key: "qty", header: "Ordered", align: "right", cell: (r) => cum(r.quantity) },
    { key: "del", header: "Delivered", align: "right", cell: (r) => cum(r.deliveredQuantity) },
    { key: "bal", header: "Balance", align: "right", cell: (r) => cum(r.quantity - r.deliveredQuantity) },
    { key: "date", header: "Delivery Date", cell: (r) => r.deliveryDate, sortValue: (r) => r.deliveryDate },
    { key: "status", header: "Status", align: "center", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "action",
      header: "Action",
      align: "right",
      cell: (r) => (
        <Button size="sm" variant={selected?.id === r.id ? "default" : "outline"} onClick={() => setSelected(r)}>
          Track
        </Button>
      ),
    },
  ];

  const tripColumns: Column<TripRow>[] = [
    { key: "trip", header: "Trip", cell: (r) => r.tripNumber },
    { key: "tm", header: "TM", cell: (r) => r.tmCode },
    { key: "driver", header: "Driver", cell: (r) => r.driverName },
    { key: "qty", header: "Quantity", align: "right", cell: (r) => cum(r.quantity) },
    { key: "dispatch", header: "Dispatch Time", cell: (r) => (r.dispatchTime ? dt(r.dispatchTime) : timeOnly(r.plannedTime)) },
    { key: "clock", header: "Concrete Clock (Discharge Before)", cell: (r) => <ConcreteClock trip={r} /> },
    { key: "status", header: "Status", align: "center", cell: (r) => <StatusBadge status={r.status} /> },
    { key: "update", header: "Last Update", cell: (r) => dt(r.lastUpdate) },
    {
      key: "challan",
      header: "Challan",
      align: "right",
      cell: (r) =>
        r.challanNumber ? (
          <a className="text-primary hover:underline" href={`/challan/${r.id}`}>
            {r.challanNumber}
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  const activeTrip = (trips.data ?? []).find((t) => t.status !== "DELIVERED") ?? (trips.data ?? [])[0];

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome, ${user?.name ?? "Customer"}`} subtitle="Your concrete orders and live delivery status" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active orders" value={String(rows.filter((r) => ["APPROVED", "IN_PROGRESS", "SUBMITTED"].includes(r.status)).length)} icon={Boxes} />
        <KpiCard label="Delivered quantity" value={cum(rows.reduce((s, r) => s + r.deliveredQuantity, 0))} icon={PackageCheck} />
        <KpiCard label="Pending quantity" value={cum(rows.reduce((s, r) => s + (r.quantity - r.deliveredQuantity), 0))} icon={Timer} />
        <KpiCard label="Outstanding invoices" value={inr(outstanding.reduce((s, i) => s + i.outstanding, 0))} icon={FileText} />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">My orders</h2>
        <DataTable
          columns={orderColumns}
          rows={rows}
          rowKey={(r) => r.id}
          emptyTitle="No orders yet"
          emptyDescription="Your purchase orders with the plant will appear here."
        />
      </section>

      {selected && (
        <div className="space-y-4">
          <ChartCard title={`Order tracking · ${selected.poNumber}`} description={`${selected.grade} · ${cum(selected.quantity)}`}>
            <Stepper steps={STAGES.map((label) => ({ label }))} current={activeTrip ? stageIndex(activeTrip.status) : 0} />
          </ChartCard>

          {/* Live Concrete Clock Workability Assurance Card for Contractor */}
          {activeTrip && ["LOADED", "QC_APPROVED", "DISPATCHED", "IN_TRANSIT"].includes(activeTrip.status) && (
            <div className="rounded-xl border border-border bg-gradient-to-r from-card via-card to-primary/5 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <ConcreteClock trip={activeTrip} variant="card" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">Live Concrete Workability Clock</h3>
                    <Badge variant="outline" className="text-[10px] text-cyan-400 border-cyan-500/30 bg-cyan-500/10">
                      IS 4926 Certified
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 max-w-lg leading-relaxed">
                    Transit Mixer <strong>{activeTrip.tmCode}</strong> carrying <strong>{selected.grade}</strong> ({activeTrip.quantity} cum) is dispatched to <strong>{selected.siteName}</strong>. To guarantee full slump workability and prevent cold joints, concrete must be placed before the countdown expires.
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0 bg-muted/40 p-2.5 rounded-lg border border-border/50">
                <span className="text-[10px] text-muted-foreground block">Assigned Driver & Truck</span>
                <span className="text-xs font-semibold text-foreground block">{activeTrip.driverName}</span>
                <span className="text-[11px] text-primary font-mono">{activeTrip.tmCode}</span>
              </div>
            </div>
          )}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Trip history</h2>
            <DataTable
              columns={tripColumns}
              rows={trips.data ?? []}
              rowKey={(r) => r.id}
              loading={trips.isLoading}
              emptyTitle="No trips yet"
              emptyDescription="Trips appear once the plant schedules your delivery."
            />
          </section>
        </div>
      )}
    </div>
  );
}
