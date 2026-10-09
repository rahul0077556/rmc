import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { CheckCircle2, ClipboardList, FlaskConical, PackageCheck, Truck } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { ChartCard } from "@/components/app/chart-card";
import { DataTable, type Column } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { LoadingState, ErrorState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/app/filter-bar";
import { useListQuery } from "@/hooks/use-list-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ordersApi, type OrderRow } from "@/api/orders";
import { tripsApi, type TripRow } from "@/api/trips";
import { useAuth } from "@/auth/auth-context";
import { cum, timeOnly } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/dispatcher/")({
  head: () => ({
    meta: [
      { title: "Dispatch Control · RMC Command Center" },
      { name: "description", content: "Plan trips, assign transit mixers and drivers, and release deliveries." },
    ],
  }),
  component: DispatcherPage,
});

function DispatcherPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [deliverTrip, setDeliverTrip] = useState<TripRow | null>(null);
  const [receiver, setReceiver] = useState("");
  const [deliveredQty, setDeliveredQty] = useState("");

  const { params, updateParams, query: trips } = useListQuery(["trips-list"], () => tripsApi.list().then((r) => r.data));
  const fleet = useQuery({ queryKey: ["fleet"], queryFn: () => tripsApi.fleet().then((r) => r.data) });
  const orders = useQuery({ queryKey: ["orders-disp"], queryFn: () => ordersApi.list().then((r) => r.data) });

  const advance = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TripRow["status"] }) =>
      tripsApi.setStatus(id, status, user?.name ?? "Dispatcher"),
    onSuccess: (res) => {
      toast.success(res.data?.status === "DISPATCHED" ? "Trip released" : "Trip updated");
      void qc.invalidateQueries({ queryKey: ["trips-list"] });
    },
  });

  const deliver = useMutation({
    mutationFn: (input: { id: string; deliveredQuantity: number; receiverName: string }) =>
      tripsApi.deliver(
        input.id,
        { deliveredQuantity: input.deliveredQuantity, receiverName: input.receiverName, deliveryTime: new Date().toISOString() },
        user?.name ?? "Dispatcher",
      ),
    onSuccess: () => {
      toast.success("Delivery recorded");
      setDeliverTrip(null);
      void qc.invalidateQueries({ queryKey: ["trips-list"] });
      void qc.invalidateQueries({ queryKey: ["orders-disp"] });
    },
  });

  const filteredOrders = useMemo(() => {
    if (!orders.data) return [];
    let list = orders.data.filter((o) => ["APPROVED", "IN_PROGRESS"].includes(o.status));
    if (params.q) {
      const lower = params.q.toLowerCase();
      list = list.filter((i) => i.poNumber.toLowerCase().includes(lower) || i.customerName.toLowerCase().includes(lower));
    }
    return list;
  }, [orders.data, params]);

  const releasable = useMemo(() => {
    if (!trips.data) return [];
    let list = trips.data.filter((t) => ["QC_APPROVED", "DISPATCHED", "IN_TRANSIT"].includes(t.status));
    if (params.q) {
      const lower = params.q.toLowerCase();
      list = list.filter((i) => i.poNumber.toLowerCase().includes(lower) || i.customerName.toLowerCase().includes(lower) || i.tripNumber.toLowerCase().includes(lower));
    }
    return list;
  }, [trips.data, params]);

  if (trips.isLoading || fleet.isLoading || orders.isLoading) return <LoadingState rows={6} />;
  if (trips.error || !trips.data || !fleet.data || !orders.data)
    return <ErrorState message="Dispatch data could not be loaded." onRetry={() => void trips.refetch()} />;

  const all = trips.data;
  const count = (s: TripRow["status"][]) => all.filter((t) => s.includes(t.status)).length;

  const orderColumns: Column<OrderRow>[] = [
    { key: "po", header: "PO Number", cell: (r) => <span className="font-medium">{r.poNumber}</span>, sortValue: (r) => r.poNumber },
    { key: "customer", header: "Customer", cell: (r) => r.customerName, sortValue: (r) => r.customerName },
    { key: "grade", header: "Grade", cell: (r) => r.grade },
    { key: "qty", header: "Quantity", align: "right", cell: (r) => cum(r.quantity), sortValue: (r) => r.quantity },
    { key: "time", header: "Delivery", cell: (r) => `${r.deliveryDate} · ${r.deliveryTime}` },
    { key: "trips", header: "Trips", align: "right", cell: (r) => r.tripCount, sortValue: (r) => r.tripCount },
    { key: "status", header: "Status", align: "center", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "action",
      header: "Action",
      align: "right",
      cell: (r) => (
        <Button
          size="sm"
          variant={r.tripCount === 0 ? "default" : "outline"}
          onClick={() => void navigate({ to: "/dispatcher/plan/$poId", params: { poId: r.id } })}
          disabled={user?.role === "owner"}
        >
          {r.tripCount === 0 ? "Plan trips" : "Review plan"}
        </Button>
      ),
    },
  ];

  const releaseColumns: Column<TripRow>[] = [
    { key: "trip", header: "Trip", cell: (r) => <span className="font-medium">{r.tripNumber}</span> },
    { key: "po", header: "PO", cell: (r) => r.poNumber },
    { key: "customer", header: "Customer", cell: (r) => r.customerName },
    { key: "grade", header: "Grade", cell: (r) => r.grade },
    { key: "qty", header: "Qty", align: "right", cell: (r) => cum(r.quantity) },
    { key: "tm", header: "TM / Driver", cell: (r) => `${r.tmCode} · ${r.driverName}` },
    { key: "status", header: "Status", align: "center", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "action",
      header: "Action",
      align: "right",
      cell: (r) => (
        <div className="flex justify-end gap-1.5">
          {r.challanNumber && (
            <Button size="sm" variant="ghost" onClick={() => void navigate({ to: "/challan/$tripId", params: { tripId: r.id } })}>
              Challan
            </Button>
          )}
          {r.status === "QC_APPROVED" && (
            <Button size="sm" disabled={user?.role === "owner"} onClick={() => advance.mutate({ id: r.id, status: "DISPATCHED" })}>
              Release
            </Button>
          )}
          {r.status === "DISPATCHED" && (
            <Button size="sm" variant="outline" disabled={user?.role === "owner"} onClick={() => advance.mutate({ id: r.id, status: "IN_TRANSIT" })}>
              In transit
            </Button>
          )}
          {r.status === "IN_TRANSIT" && (
            <Button
              size="sm"
              variant="outline"
              disabled={user?.role === "owner"}
              onClick={() => {
                setDeliverTrip(r);
                setDeliveredQty(String(r.quantity));
                setReceiver("");
              }}
            >
              Mark delivered
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Today's Operations" subtitle="Dispatch control — planning, release and delivery" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Orders to plan" value={String(filteredOrders.filter((o) => o.tripCount === 0).length)} icon={ClipboardList} comparison="approved, unplanned" />
        <KpiCard label="Trips in production" value={String(count(["SENT_TO_PRODUCTION", "BATCHING", "LOADED"]))} icon={PackageCheck} comparison="batching now" />
        <KpiCard label="QC pending" value={String(count(["QC_PENDING"]))} icon={FlaskConical} comparison="awaiting quality sign-off" />
        <KpiCard label="Ready for dispatch" value={String(count(["QC_APPROVED"]))} icon={Truck} comparison="QC approved trips" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Transit mixer availability" description="By capacity" className="lg:col-span-2" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  {["Capacity", "Available", "Assigned", "Loaded", "In transit", "Maintenance"].map((h) => (
                    <th key={h} className={cn("border-b border-border px-4 py-2.5", h === "Capacity" ? "text-left" : "text-right")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fleet.data.byCapacity.map((row) => (
                  <tr key={row.capacity} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2.5 font-medium">{row.capacity} cum</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-success">{row.available}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{row.assigned}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{row.loaded}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-info">{row.inTransit}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-warning">{row.maintenance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        <ChartCard title="Driver availability" description="Shift roster">
          <ul className="space-y-3 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Available</span>
              <span className="font-medium text-success tabular-nums">{fleet.data.drivers.available}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Assigned</span>
              <span className="font-medium tabular-nums">{fleet.data.drivers.assigned}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Unavailable</span>
              <span className="font-medium text-muted-foreground tabular-nums">{fleet.data.drivers.unavailable}</span>
            </li>
          </ul>
        </ChartCard>
      </div>
      
      <FilterBar
        search={params.q}
        onSearchChange={(q) => updateParams({ q })}
        searchPlaceholder="Search PO, Trip or Customer..."
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Dispatch queue</h2>
        <DataTable
          columns={orderColumns}
          rows={filteredOrders}
          rowKey={(r) => r.id}
          emptyTitle="No approved orders waiting"
          emptyDescription="Orders appear here once the sales manager approves them."
        />
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="size-4 text-success" /> Release & delivery
        </h2>
        <DataTable
          columns={releaseColumns}
          rows={releasable}
          rowKey={(r) => r.id}
          emptyTitle="Nothing ready to release"
          emptyDescription="Trips appear here after quality control approves the batch."
        />
      </section>

      <Dialog open={deliverTrip !== null} onOpenChange={(open) => !open && setDeliverTrip(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record delivery</DialogTitle>
            <DialogDescription>
              {deliverTrip?.tripNumber} · {deliverTrip?.customerName} · {deliverTrip && timeOnly(deliverTrip.plannedTime)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="dq">Delivered quantity (cum)</Label>
              <Input id="dq" value={deliveredQty} onChange={(e) => setDeliveredQty(e.target.value)} inputMode="decimal" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rc">Receiver name</Label>
              <Input id="rc" value={receiver} onChange={(e) => setReceiver(e.target.value)} placeholder="Site engineer name" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliverTrip(null)}>
              Cancel
            </Button>
            <Button
              disabled={!receiver || !deliveredQty}
              onClick={() =>
                deliverTrip &&
                deliver.mutate({ id: deliverTrip.id, deliveredQuantity: Number(deliveredQty), receiverName: receiver })
              }
            >
              Save delivery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
