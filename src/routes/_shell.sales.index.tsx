import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, FileEdit, FileText, Plus, Truck, Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { DataTable, type Column } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { LoadingState, ErrorState } from "@/components/app/states";
import { ChartCard } from "@/components/app/chart-card";
import { Button } from "@/components/ui/button";
import { ordersApi, type OrderRow } from "@/api/orders";
import { customersApi } from "@/api/customers";
import { cum, inr } from "@/lib/format";
import { CapacityCalendar } from "@/components/common/CapacityCalendar";

export const Route = createFileRoute("/_shell/sales/")({
  head: () => ({
    meta: [
      { title: "Sales Desk · RMC Command Center" },
      { name: "description", content: "Customers, purchase orders and upcoming concrete deliveries." },
      { property: "og:title", content: "Sales Desk · RMC Command Center" },
      { property: "og:description", content: "Customers, purchase orders and upcoming concrete deliveries." },
    ],
  }),
  component: SalesPage,
});

function SalesPage() {
  const navigate = useNavigate();
  const orders = useQuery({ queryKey: ["orders"], queryFn: () => ordersApi.list().then((r) => r.data) });
  const customers = useQuery({ queryKey: ["customers"], queryFn: () => customersApi.list().then((r) => r.data) });

  if (orders.isLoading || customers.isLoading) return <LoadingState rows={5} />;
  if (orders.error || !orders.data || !customers.data)
    return <ErrorState message="Sales data could not be loaded." onRetry={() => void orders.refetch()} />;

  const all = orders.data;
  const today = new Date().toISOString().slice(0, 10);

  const columns: Column<OrderRow>[] = [
    { key: "po", header: "PO Number", cell: (r) => <span className="font-medium">{r.poNumber}</span>, sortValue: (r) => r.poNumber },
    { key: "customer", header: "Customer", cell: (r) => r.customerName },
    { key: "site", header: "Site", cell: (r) => <span className="text-muted-foreground">{r.siteName}</span> },
    { key: "grade", header: "Grade", cell: (r) => r.grade },
    { key: "qty", header: "Quantity", align: "right", cell: (r) => cum(r.quantity), sortValue: (r) => r.quantity },
    { key: "date", header: "Delivery", cell: (r) => r.deliveryDate, sortValue: (r) => r.deliveryDate },
    { key: "status", header: "Status", align: "center", cell: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Desk"
        subtitle="Order pipeline, customers and upcoming deliveries"
        actions={
          <Button onClick={() => void navigate({ to: "/sales/orders/new" })}>
            <Plus className="size-4" /> Create PO
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Customers" value={String(customers.data.length)} icon={Users} comparison="active accounts" />
        <KpiCard label="Active POs" value={String(all.filter((o) => ["APPROVED", "IN_PROGRESS"].includes(o.status)).length)} icon={FileText} comparison="in delivery" />
        <KpiCard label="Draft POs" value={String(all.filter((o) => o.status === "DRAFT").length)} icon={FileEdit} comparison="not submitted" />
        <KpiCard label="Pending approvals" value={String(all.filter((o) => o.status === "SUBMITTED").length)} icon={ClipboardCheck} comparison="with sales manager" />
        <KpiCard label="Today's deliveries" value={String(all.filter((o) => o.deliveryDate === today).length)} icon={Truck} comparison="scheduled today" />
      </div>

      {/* 14-Day Plant Capacity & Live Slot Booking */}
      <CapacityCalendar />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Recent purchase orders</h2>
        <DataTable
          columns={columns}
          rows={all.slice(0, 12)}
          rowKey={(r) => r.id}
          onRowClick={(r) => void navigate({ to: "/sales/orders/$poId", params: { poId: r.id } })}
          emptyTitle="No purchase orders yet"
          emptyDescription="Create the first PO to start the order-to-delivery flow."
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Customer overview" description="Credit position and live orders" bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {customers.data.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.contactPerson} · {c.creditDays} day credit
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm tabular-nums">{inr(c.creditLimit)}</p>
                  <p className="text-xs text-muted-foreground">{c.activeOrders} active orders</p>
                </div>
              </li>
            ))}
          </ul>
        </ChartCard>

        <ChartCard title="Upcoming deliveries" description="Next scheduled pours" bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {all
              .filter((o) => o.deliveryDate >= today && ["APPROVED", "IN_PROGRESS", "SUBMITTED"].includes(o.status))
              .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate))
              .slice(0, 6)
              .map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{o.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.poNumber} · {o.grade} · {cum(o.quantity)}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p>{o.deliveryDate}</p>
                    <p className="text-muted-foreground">{o.deliveryTime}</p>
                  </div>
                </li>
              ))}
            {all.filter((o) => o.deliveryDate >= today).length === 0 && (
              <li className="px-4 py-8 text-center text-xs text-muted-foreground">No deliveries scheduled.</li>
            )}
          </ul>
        </ChartCard>
      </div>
    </div>
  );
}
