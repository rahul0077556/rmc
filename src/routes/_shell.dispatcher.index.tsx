import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { CheckCircle2, ClipboardList, Clock, Flame, FlaskConical, PackageCheck, ShieldAlert, Sparkles, Truck, Zap, Tv, CalendarDays, Printer } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { CapacityCalendar } from "@/components/common/CapacityCalendar";
import { KpiCard } from "@/components/app/kpi-card";
import { ChartCard } from "@/components/app/chart-card";
import { DataTable, type Column } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { LoadingState, ErrorState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { ConcreteClock, ConcreteClockConfigModal } from "@/components/common/ConcreteClock";
import { sortByConcreteClockUrgency, getConcreteClockState } from "@/lib/concrete-clock";

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
  const [showCapacity, setShowCapacity] = useState(false);

  const { params, updateParams, query: trips } = useListQuery(
    ["trips-list"],
    () => tripsApi.list().then((r) => r.data),
    { refetchInterval: 4000 }
  );
  const fleet = useQuery({ queryKey: ["fleet"], queryFn: () => tripsApi.fleet().then((r) => r.data) });
  const orders = useQuery({
    queryKey: ["orders-disp"],
    queryFn: () => ordersApi.list().then((r) => r.data),
    refetchInterval: 5000,
  });

  const advance = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TripRow["status"] }) =>
      tripsApi.setStatus(id, status, user?.name ?? "Dispatcher"),
    onSuccess: (res) => {
      toast.success(res.data?.status === "DISPATCHED" ? "Trip released" : "Trip status updated to " + (res.data?.status || "updated"));
      void qc.invalidateQueries({ queryKey: ["trips-list"] });
      void qc.invalidateQueries({ queryKey: ["orders-disp"] });
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

  const [prioritySort, setPrioritySort] = useState(true);
  const [orderFilterTab, setOrderFilterTab] = useState<"active" | "all" | "completed">("active");
  const [tripFilterTab, setTripFilterTab] = useState<"active" | "delivered" | "all">("active");

  const filteredOrders = useMemo(() => {
    if (!orders.data) return [];
    let list = orders.data;
    if (orderFilterTab === "active") {
      list = list.filter((o) => ["APPROVED", "IN_PROGRESS"].includes(o.status));
    } else if (orderFilterTab === "completed") {
      list = list.filter((o) => ["COMPLETED", "DELIVERED"].includes(o.status));
    }
    if (params.q) {
      const lower = params.q.toLowerCase();
      list = list.filter((i) => i.poNumber.toLowerCase().includes(lower) || i.customerName.toLowerCase().includes(lower));
    }
    return list;
  }, [orders.data, params, orderFilterTab]);

  const releasable = useMemo(() => {
    if (!trips.data) return [];
    let list = trips.data;
    if (tripFilterTab === "active") {
      list = list.filter((t) => ["LOADED", "QC_APPROVED", "DISPATCHED", "IN_TRANSIT"].includes(t.status));
    } else if (tripFilterTab === "delivered") {
      list = list.filter((t) => t.status === "DELIVERED");
    } else {
      list = list.filter((t) => ["LOADED", "QC_APPROVED", "DISPATCHED", "IN_TRANSIT", "DELIVERED"].includes(t.status));
    }
    if (params.q) {
      const lower = params.q.toLowerCase();
      list = list.filter(
        (i) =>
          i.poNumber.toLowerCase().includes(lower) ||
          i.customerName.toLowerCase().includes(lower) ||
          i.tripNumber.toLowerCase().includes(lower) ||
          (i.challanNumber && i.challanNumber.toLowerCase().includes(lower))
      );
    }
    if (prioritySort && tripFilterTab === "active") {
      list = sortByConcreteClockUrgency(list);
    }
    return list;
  }, [trips.data, params, prioritySort, tripFilterTab]);

  const deliveredTrips = useMemo(() => {
    if (!trips.data) return [];
    let list = trips.data.filter((t) => t.status === "DELIVERED");
    if (params.q) {
      const lower = params.q.toLowerCase();
      list = list.filter(
        (i) =>
          i.poNumber.toLowerCase().includes(lower) ||
          i.customerName.toLowerCase().includes(lower) ||
          i.tripNumber.toLowerCase().includes(lower) ||
          (i.challanNumber && i.challanNumber.toLowerCase().includes(lower))
      );
    }
    return list;
  }, [trips.data, params]);

  const clockCounts = useMemo(() => {
    let healthy = 0;
    let warning = 0;
    let critical = 0;
    let expired = 0;
    const activeTrips = (trips.data || []).filter((t) => ["LOADED", "QC_APPROVED", "DISPATCHED", "IN_TRANSIT"].includes(t.status));
    for (const trip of activeTrips) {
      const c = getConcreteClockState(trip);
      if (c.status === "healthy") healthy++;
      else if (c.status === "warning") warning++;
      else if (c.status === "critical") critical++;
      else if (c.status === "expired") expired++;
    }
    return { healthy, warning, critical, expired, total: activeTrips.length };
  }, [trips.data]);

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
    { key: "trip", header: "Trip", cell: (r) => <span className="font-semibold">{r.tripNumber}</span> },
    { key: "po", header: "PO", cell: (r) => <span className="text-muted-foreground font-medium">{r.poNumber}</span> },
    {
      key: "customer",
      header: "Customer & Site",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.customerName}</p>
          <p className="text-xs text-muted-foreground">{r.siteName}</p>
        </div>
      ),
    },
    { key: "grade", header: "Grade", cell: (r) => <Badge variant="outline">{r.grade}</Badge> },
    {
      key: "qty",
      header: "Qty",
      align: "right",
      cell: (r) => (
        <span className="font-medium">
          {r.status === "DELIVERED" ? `${cum(r.deliveredQuantity ?? r.quantity)} delivered` : cum(r.quantity)}
        </span>
      ),
    },
    { key: "tm", header: "TM / Driver", cell: (r) => `${r.tmCode} · ${r.driverName}` },
    {
      key: "concreteClock",
      header: "Concrete Clock / Site Delivery",
      className: "min-w-[195px]",
      cell: (r) =>
        r.status === "DELIVERED" ? (
          <div className="flex flex-col text-xs">
            <span className="font-semibold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="size-3.5" /> Delivered at site
            </span>
            <span className="text-[11px] text-muted-foreground">
              {r.receiverName ? `Signed: ${r.receiverName}` : (r.deliveredAt ? `Time: ${timeOnly(r.deliveredAt)}` : "Sign-off recorded")}
            </span>
          </div>
        ) : (
          <ConcreteClock trip={r} />
        ),
      sortValue: (r) => (r.status === "DELIVERED" ? 9999 : getConcreteClockState(r).remainingMinutes),
    },
    { key: "status", header: "Status", align: "center", className: "min-w-[100px]", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "action",
      header: "Action",
      align: "right",
      className: "min-w-[160px]",
      cell: (r) => (
        <div className="flex justify-end gap-1.5">
          {r.challanNumber && (
            <Button
              size="sm"
              variant={r.status === "DELIVERED" ? "outline" : "ghost"}
              className="gap-1 text-xs h-8"
              onClick={() => void navigate({ to: "/challan/$tripId", params: { tripId: r.id }, search: { from: "dispatcher" } })}
            >
              <Printer className="size-3" /> View Challan
            </Button>
          )}
          {r.status === "QC_APPROVED" && (
            <Button size="sm" className="h-8" disabled={user?.role === "owner"} onClick={() => advance.mutate({ id: r.id, status: "DISPATCHED" })}>
              Release
            </Button>
          )}
          {r.status === "DISPATCHED" && (
            <Button size="sm" variant="outline" className="gap-1 border-sky-500/40 text-sky-400 hover:bg-sky-500/10 h-8 text-xs font-semibold" disabled={user?.role === "owner"} onClick={() => advance.mutate({ id: r.id, status: "IN_TRANSIT" })}>
              <Truck className="size-3.5" /> In transit
            </Button>
          )}
          {r.status === "IN_TRANSIT" && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 h-8 text-xs font-semibold"
              disabled={user?.role === "owner"}
              onClick={() => {
                setDeliverTrip(r);
                setDeliveredQty(String(r.quantity));
                setReceiver("");
              }}
            >
              <CheckCircle2 className="size-3.5" /> Mark delivered
            </Button>
          )}
        </div>
      ),
    },
  ];

  const deliveredColumns: Column<TripRow>[] = [
    { key: "trip", header: "Trip #", cell: (r) => <span className="font-semibold">{r.tripNumber}</span>, sortValue: (r) => r.tripNumber },
    {
      key: "challan",
      header: "Challan #",
      cell: (r) => (
        <span className="font-mono text-xs text-primary font-medium">
          {r.challanNumber || "—"}
        </span>
      ),
      sortValue: (r) => r.challanNumber || "",
    },
    {
      key: "customer",
      header: "Customer / Site",
      cell: (r) => (
        <div>
          <p className="font-medium text-xs">{r.customerName}</p>
          <p className="text-[11px] text-muted-foreground">{r.siteName}</p>
        </div>
      ),
      sortValue: (r) => r.customerName,
    },
    { key: "grade", header: "Grade", cell: (r) => <Badge variant="outline">{r.grade}</Badge> },
    {
      key: "qty",
      header: "Delivered",
      align: "right",
      cell: (r) => (
        <span className="font-semibold text-emerald-400">
          {cum(r.deliveredQuantity ?? r.quantity)}
        </span>
      ),
      sortValue: (r) => r.deliveredQuantity ?? r.quantity,
    },
    { key: "tm", header: "TM / Driver", cell: (r) => `${r.tmCode} · ${r.driverName}` },
    {
      key: "signed",
      header: "Signed By",
      cell: (r) => (
        <div className="flex flex-col text-xs">
          <span className="font-medium text-foreground">{r.receiverName || "Site Engineer"}</span>
          <span className="text-[11px] text-muted-foreground">{r.deliveredAt ? timeOnly(r.deliveredAt) : "Completed"}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      cell: () => (
        <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-xs">
          Delivered
        </Badge>
      ),
    },
    {
      key: "action",
      header: "Action",
      align: "right",
      cell: (r) => (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs h-8 border-border hover:bg-surface-raised cursor-pointer"
          onClick={() => void navigate({ to: "/challan/$tripId", params: { tripId: r.id }, search: { from: "dispatcher" } })}
        >
          <Printer className="size-3" /> View Challan
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Today's Operations"
        subtitle="Dispatch control — planning, release and delivery"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={showCapacity ? "default" : "outline"}
              size="sm"
              onClick={() => setShowCapacity((v) => !v)}
              className="gap-1.5 font-medium"
            >
              <CalendarDays className="size-4" />
              <span>{showCapacity ? "Hide Capacity" : "14-Day Capacity"}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void navigate({ to: "/tv" })}
              className="gap-2 border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary font-medium"
            >
              <Tv className="size-4 text-primary animate-pulse" />
              <span>Control Room TV Mode</span>
            </Button>
          </div>
        }
      />

      {showCapacity && (
        <div className="animate-in fade-in-50 duration-200">
          <CapacityCalendar />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Orders to plan" value={String(filteredOrders.filter((o) => o.tripCount === 0).length)} icon={ClipboardList} comparison="approved, unplanned" />
        <KpiCard label="Trips in production" value={String(count(["SENT_TO_PRODUCTION", "BATCHING", "LOADED"]))} icon={PackageCheck} comparison="batching now" />
        <KpiCard label="Ready for dispatch" value={String(count(["QC_APPROVED"]))} icon={Clock} comparison="QC approved trips" />
        <KpiCard label="On road / in transit" value={String(count(["DISPATCHED", "IN_TRANSIT"]))} icon={Truck} comparison="en route to site" />
        <KpiCard label="Delivered today" value={String(count(["DELIVERED"]))} icon={CheckCircle2} comparison="signed off at site" />
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Customer Purchase Orders</h2>
            <Badge variant="outline" className="text-[10px] font-semibold text-muted-foreground">
              {filteredOrders.length} shown
            </Badge>
          </div>
          <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg border border-border/60">
            <button
              type="button"
              onClick={() => setOrderFilterTab("active")}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer",
                orderFilterTab === "active"
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Active to Plan ({orders.data?.filter((o) => ["APPROVED", "IN_PROGRESS"].includes(o.status)).length || 0})
            </button>
            <button
              type="button"
              onClick={() => setOrderFilterTab("completed")}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer",
                orderFilterTab === "completed"
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Delivered / Fulfilled ({orders.data?.filter((o) => ["COMPLETED", "DELIVERED"].includes(o.status)).length || 0})
            </button>
            <button
              type="button"
              onClick={() => setOrderFilterTab("all")}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer",
                orderFilterTab === "all"
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All Orders ({orders.data?.length || 0})
            </button>
          </div>
        </div>

        <DataTable
          columns={orderColumns}
          rows={filteredOrders}
          rowKey={(r) => r.id}
          emptyTitle={
            orderFilterTab === "active"
              ? "No active orders waiting to plan"
              : orderFilterTab === "completed"
              ? "No fulfilled orders found"
              : "No orders match criteria"
          }
          emptyDescription="Orders appear here after creation and management."
        />
      </section>

      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="size-4 text-success" /> Release & delivery
            </h2>
            <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10 text-[10px] gap-1 font-semibold">
              <Clock className="size-3 text-cyan-400" /> Concrete Clock Active (IS 4926)
            </Badge>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Tabs for Release & Delivery */}
            <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg border border-border/60">
              <button
                type="button"
                onClick={() => setTripFilterTab("active")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer",
                  tripFilterTab === "active"
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Active on Road ({trips.data?.filter((t) => ["LOADED", "QC_APPROVED", "DISPATCHED", "IN_TRANSIT"].includes(t.status)).length || 0})
              </button>
              <button
                type="button"
                onClick={() => setTripFilterTab("delivered")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer",
                  tripFilterTab === "delivered"
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Delivered at Site ({trips.data?.filter((t) => t.status === "DELIVERED").length || 0})
              </button>
              <button
                type="button"
                onClick={() => setTripFilterTab("all")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer",
                  tripFilterTab === "all"
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All Trips ({trips.data?.length || 0})
              </button>
            </div>

            {/* Priority sort toggle: trucks about to expire jump to top */}
            {tripFilterTab === "active" && (
              <Button
                variant={prioritySort ? "default" : "outline"}
                size="sm"
                onClick={() => setPrioritySort((s) => !s)}
                className={cn(
                  "h-8 gap-1.5 text-xs font-medium transition-all",
                  prioritySort
                    ? "bg-gradient-to-r from-amber-500 to-rose-600 text-white shadow-sm"
                    : "border-border text-muted-foreground"
                )}
                title="When active, loaded trucks about to reach discharge limit jump to the top of the board"
              >
                <Zap className="size-3.5" />
                <span>Priority: Expiring First</span>
              </Button>
            )}

            <ConcreteClockConfigModal />
          </div>
        </div>

        {/* Live Clock Summary Strip */}
        {tripFilterTab === "active" && clockCounts.total > 0 && (
          <div className="flex items-center gap-3 text-xs bg-surface-raised border border-border p-2.5 rounded-lg overflow-x-auto">
            <span className="text-muted-foreground font-medium text-[11px] shrink-0">Hydration Monitors:</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
              <span className="size-2 rounded-full bg-emerald-400" />
              {clockCounts.healthy} Healthy (&gt;45m)
            </span>
            <span className="inline-flex items-center gap-1.5 text-amber-400 font-semibold text-[11px]">
              <span className="size-2 rounded-full bg-amber-400" />
              {clockCounts.warning} Warning (&lt;45m)
            </span>
            {(clockCounts.critical > 0 || clockCounts.expired > 0) && (
              <span className="inline-flex items-center gap-1.5 text-rose-400 font-bold text-[11px] animate-pulse">
                <span className="size-2 rounded-full bg-rose-500" />
                {clockCounts.critical + clockCounts.expired} Expiring / Overdue Risk!
              </span>
            )}
          </div>
        )}

        <DataTable
          columns={releaseColumns}
          rows={releasable}
          rowKey={(r) => r.id}
          emptyTitle={
            tripFilterTab === "delivered"
              ? "No completed deliveries found"
              : tripFilterTab === "active"
              ? "No active trucks waiting to release or on road"
              : "No trips found matching criteria"
          }
          emptyDescription="Trips appear here as they move from plant QC to dispatch and site delivery."
        />
      </section>

      {/* Today's Completed Concrete Deliveries */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="size-4 text-emerald-400" /> Today's Completed Concrete Deliveries
            </h2>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-[10px] gap-1 font-semibold">
              {deliveredTrips.length} signed off
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            Real-time delivery sign-offs synced with Site Supervisor desk
          </span>
        </div>

        <DataTable
          columns={deliveredColumns}
          rows={deliveredTrips}
          rowKey={(r) => r.id}
          emptyTitle="No completed deliveries yet today"
          emptyDescription="When site supervisors record delivery sign-offs at site pump, completed trips appear here with signed challans."
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
