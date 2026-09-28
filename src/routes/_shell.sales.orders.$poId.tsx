import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/page-header";
import { ChartCard } from "@/components/app/chart-card";
import { DataTable, type Column } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { LoadingState, ErrorState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { ordersApi } from "@/api/orders";
import { tripsApi, type TripRow } from "@/api/trips";
import { cum, inr, timeOnly } from "@/lib/format";

export const Route = createFileRoute("/_shell/sales/orders/$poId")({
  head: () => ({
    meta: [
      { title: "Order Detail · RMC Command Center" },
      { name: "description", content: "Purchase order detail with trips, delivery progress and commercial terms." },
      { property: "og:title", content: "Order Detail · RMC Command Center" },
      { property: "og:description", content: "Purchase order detail with trips, delivery progress and commercial terms." },
    ],
  }),
  component: OrderDetailPage,
});

function OrderDetailPage() {
  const { poId } = Route.useParams();
  const navigate = useNavigate();
  const order = useQuery({ queryKey: ["order", poId], queryFn: () => ordersApi.get(poId).then((r) => r.data) });
  const trips = useQuery({ queryKey: ["trips", poId], queryFn: () => tripsApi.list({ poId }).then((r) => r.data) });

  if (order.isLoading) return <LoadingState rows={5} />;
  if (order.error || !order.data) return <ErrorState message="This purchase order could not be found." />;

  const po = order.data;

  const columns: Column<TripRow>[] = [
    { key: "trip", header: "Trip", cell: (r) => <span className="font-medium">{r.tripNumber}</span> },
    { key: "tm", header: "TM / Driver", cell: (r) => `${r.tmCode} · ${r.driverName}` },
    { key: "qty", header: "Quantity", align: "right", cell: (r) => cum(r.quantity) },
    { key: "planned", header: "Planned", cell: (r) => timeOnly(r.plannedTime) },
    { key: "status", header: "Status", align: "center", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "challan",
      header: "Challan",
      align: "right",
      cell: (r) =>
        r.challanNumber ? (
          <Button size="sm" variant="ghost" onClick={() => void navigate({ to: "/challan/$tripId", params: { tripId: r.id } })}>
            {r.challanNumber}
          </Button>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={po.poNumber}
        subtitle={`${po.customerName} · ${po.siteName}`}
        actions={
          <>
            <StatusBadge status={po.status} />
            <Button variant="outline" onClick={() => void navigate({ to: "/sales/orders" })}>
              Back to orders
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Order details" description="Grade, volume and schedule" className="lg:col-span-2">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            {[
              ["Grade", po.grade],
              ["Ordered quantity", cum(po.quantity)],
              ["Delivered quantity", cum(po.deliveredQuantity)],
              ["Balance", cum(po.quantity - po.deliveredQuantity)],
              ["Rate per cum", inr(po.ratePerCum)],
              ["Delivery", `${po.deliveryDate} ${po.deliveryTime}`],
              ["Purpose", po.purpose],
              ["Pump", po.pumpRequired ? `${po.pumpOwnership} · ${po.pumpType}` : "Not required"],
              ["Payment terms", po.paymentTerms],
              ["Created by", po.createdBy],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-border/60 pb-1.5">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </div>
          {po.notes && <p className="mt-4 text-sm text-muted-foreground">{po.notes}</p>}
        </ChartCard>

        <ChartCard title="Order value" description="Excluding taxes">
          <p className="text-3xl font-semibold tabular-nums">{inr(po.quantity * po.ratePerCum)}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {cum(po.deliveredQuantity)} delivered of {cum(po.quantity)}
          </p>
          {po.rejectionReason && (
            <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              {po.rejectionReason}
            </p>
          )}
        </ChartCard>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Trips</h2>
        <DataTable
          columns={columns}
          rows={trips.data ?? []}
          rowKey={(r) => r.id}
          loading={trips.isLoading}
          emptyTitle="No trips planned"
          emptyDescription="Dispatch creates trips once the order is approved."
        />
      </section>
    </div>
  );
}
