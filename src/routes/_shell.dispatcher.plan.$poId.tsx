import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Factory, Loader2, MessageSquare, Plus, Trash2, Truck as TruckIcon } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ChartCard } from "@/components/app/chart-card";
import { LoadingState, ErrorState } from "@/components/app/states";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ordersApi } from "@/api/orders";
import { tripsApi } from "@/api/trips";
import { useAuth } from "@/auth/auth-context";
import { cum } from "@/lib/format";

export const Route = createFileRoute("/_shell/dispatcher/plan/$poId")({
  head: () => ({
    meta: [
      { title: "Trip Planning · RMC Command Center" },
      { name: "description", content: "Split an approved order into trips and assign transit mixers and drivers." },
      { property: "og:title", content: "Trip Planning · RMC Command Center" },
      { property: "og:description", content: "Split an approved order into trips and assign transit mixers and drivers." },
    ],
  }),
  component: PlanPage,
});

interface PlannedTrip {
  key: string;
  quantity: number;
  tmId: string;
  driverId: string;
  plannedTime: string;
}

const CHECKS = [
  "Grade verified against customer requirement",
  "Quantity verified",
  "Site address and access verified",
  "Delivery date and time confirmed",
  "Pump requirement verified",
  "Grade confirmed with customer over WhatsApp",
];

function PlanPage() {
  const { poId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [checks, setChecks] = useState<boolean[]>(CHECKS.map(() => false));
  const [trips, setTrips] = useState<PlannedTrip[]>([]);
  const [sent, setSent] = useState(false);

  const order = useQuery({ queryKey: ["order", poId], queryFn: () => ordersApi.get(poId).then((r) => r.data) });
  const trucksQuery = useQuery({ queryKey: ["trucks-plan"], queryFn: () => tripsApi.trucks().then((r) => r.data) });
  const driversQuery = useQuery({ queryKey: ["drivers-plan"], queryFn: () => tripsApi.drivers().then((r) => r.data) });
  const existingTripsQuery = useQuery({
    queryKey: ["trips-po", poId],
    queryFn: () => tripsApi.list({ poId }).then((r) => r.data),
    refetchInterval: 3000,
  });

  const existingTrips = existingTripsQuery.data || [];
  const po = order.data;
  const balance = po?.balanceQuantity ?? 0;
  const isFullyPlanned = Boolean(po && (balance <= 0.001 || existingTrips.length > 0 && balance === 0));
  const planned = trips.reduce((s, t) => s + t.quantity, 0);
  const allChecked = checks.every(Boolean);

  useEffect(() => {
    if (!po) return;
    // If order is fully planned, do not pre-populate unassigned trips
    if (balance <= 0.001) {
      setTrips([]);
      return;
    }
    if (trips.length > 0) return;

    const per = 8;
    const parts: number[] = [];
    let left = balance;
    while (left > 0) {
      parts.push(Math.min(per, left));
      left -= per;
    }
    const base = new Date(`${po.deliveryDate}T${po.deliveryTime || "09:00"}:00`);
    const availableTrucks = (trucksQuery.data || []).filter((t) => t.status === "AVAILABLE");
    const availableDrivers = (driversQuery.data || []).filter((d) => d.status === "AVAILABLE");
    setTrips(
      parts.map((q, i) => ({
        key: `t${i}`,
        quantity: q,
        tmId: availableTrucks[i]?.id ?? "",
        driverId: availableDrivers[i]?.id ?? "",
        plannedTime: new Date(base.getTime() + i * 90 * 60000).toISOString(),
      })),
    );
  }, [po, trucksQuery.data, driversQuery.data, trips.length, balance]);

  const savePlan = useMutation({
    mutationFn: () => {
      const targetPoId = po?.id || poId;
      if (planned > balance + 0.001) {
        throw new Error(`Total planned quantity (${planned} cum) exceeds available PO balance (${balance} cum).`);
      }
      return tripsApi.plan(
        targetPoId,
        trips.map((t) => ({
          quantity: t.quantity,
          tmId: t.tmId || undefined,
          driverId: t.driverId || undefined,
          plannedTime: t.plannedTime,
        })),
        user?.name ?? "Dispatcher",
      );
    },
    onSuccess: () => {
      toast.success("Trips assigned & sent to production successfully!");
      void qc.invalidateQueries({ queryKey: ["trips"] });
      void qc.invalidateQueries({ queryKey: ["trips-po", poId] });
      void qc.invalidateQueries({ queryKey: ["orders"] });
      void qc.invalidateQueries({ queryKey: ["production-queue"] });
      setSent(true);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to send trips to production. Please verify truck & driver assignments.");
    },
  });

  if (order.isLoading) return <LoadingState rows={5} />;
  if (order.error || !order.data) return <ErrorState message="This purchase order could not be loaded." />;


  return (
    <div className="space-y-6">
      <PageHeader
        title={`Plan ${po.poNumber}`}
        subtitle={`${po.customerName} · ${po.grade} · ${cum(po.quantity)} · ${po.deliveryDate} ${po.deliveryTime}`}
        actions={
          <Button variant="outline" onClick={() => void navigate({ to: "/dispatcher" })}>
            Back to dispatch
          </Button>
        }
      />

      <div className="space-y-4">
        {existingTrips.length > 0 && (
          <ChartCard
            title={`Active Trips for ${po.poNumber}`}
            description={`${existingTrips.length} trip${existingTrips.length > 1 ? "s" : ""} created · ${cum(existingTrips.reduce((s, t) => s + (t.quantity || 0), 0))} allocated`}
          >
            <div className="divide-y divide-border rounded-xl border border-border bg-surface-raised">
              {existingTrips.map((et, idx) => (
                <div key={et.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-surface font-mono text-xs font-bold text-foreground">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{et.tripNumber}</span>
                        <StatusBadge status={et.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {et.tmNumber || "TM Pending"} · {et.driverName || "Driver Pending"} · {cum(et.quantity)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground">
                      Planned: {et.plannedTime ? new Date(et.plannedTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        )}

        {isFullyPlanned ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-6 text-emerald-400 shrink-0" />
              <div>
                <h3 className="font-semibold text-emerald-300">Order Fully Planned & Dispatched</h3>
                <p className="text-sm text-emerald-200/80">
                  All {cum(po.quantity)} for this order have been allocated across {existingTrips.length} trips and dispatched to production.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button className="bg-emerald-600 hover:bg-emerald-500 text-white" onClick={() => void navigate({ to: "/production" })}>
                <Factory className="size-4 mr-1.5" /> Go to Production Queue
              </Button>
              <Button variant="outline" onClick={() => void navigate({ to: "/dispatcher" })}>
                Back to Dispatch Control
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <ChartCard
              title={existingTrips.length > 0 ? "Plan Remaining Balance" : "Trip planning"}
              description={`${cum(planned)} planned of remaining ${cum(balance)}`}
              actions={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setTrips((t) => [
                      ...t,
                      {
                        key: `t${Date.now()}`,
                        quantity: Math.max(1, balance - planned),
                        tmId: "",
                        driverId: "",
                        plannedTime: new Date().toISOString(),
                      },
                    ])
                  }
                >
                  <Plus className="size-3.5" /> Add trip
                </Button>
              }
            >
              <div className="space-y-3">
                {trips.map((trip, i) => (
                  <div key={trip.key} className="rounded-xl border border-border bg-surface-raised p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-medium">Trip {existingTrips.length + i + 1}</p>
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => setTrips((t) => t.filter((x) => x.key !== trip.key))}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Quantity (cum)</Label>
                        <Input
                          value={trip.quantity}
                          inputMode="decimal"
                          onChange={(e) =>
                            setTrips((t) =>
                              t.map((x) => (x.key === trip.key ? { ...x, quantity: Number(e.target.value) || 0 } : x)),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Transit mixer</Label>
                        <Select
                          value={trip.tmId}
                          onValueChange={(v) => setTrips((t) => t.map((x) => (x.key === trip.key ? { ...x, tmId: v } : x)))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Assign TM" />
                          </SelectTrigger>
                          <SelectContent>
                            {(trucksQuery.data || []).map((tm) => (
                              <SelectItem key={tm.id} value={tm.id}>
                                {tm.tmNumber} · {tm.capacity} cum
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Driver</Label>
                        <Select
                          value={trip.driverId}
                          onValueChange={(v) => setTrips((t) => t.map((x) => (x.key === trip.key ? { ...x, driverId: v } : x)))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Assign driver" />
                          </SelectTrigger>
                          <SelectContent>
                            {(driversQuery.data || []).map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Planned time</Label>
                        <Input
                          type="time"
                          value={trip.plannedTime.slice(11, 16)}
                          onChange={(e) =>
                            setTrips((t) =>
                              t.map((x) =>
                                x.key === trip.key
                                  ? { ...x, plannedTime: `${x.plannedTime.slice(0, 11)}${e.target.value}:00.000Z` }
                                  : x,
                              ),
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ChartCard>

            <div className="space-y-4">
              <ChartCard title="Verification checklist" description="Complete before sending to production">
                <ul className="space-y-2.5">
                  {CHECKS.map((label, i) => (
                    <li key={label}>
                      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted-foreground">
                        <Checkbox
                          checked={checks[i]}
                          onCheckedChange={(v) => setChecks((c) => c.map((x, idx) => (idx === i ? v === true : x)))}
                        />
                        <span>{label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </ChartCard>

              <ChartCard title="Site accessibility" description={po.siteName}>
                <p className="text-sm text-muted-foreground">{po.siteAddress ?? "Standard transit mixer and concrete pump access."}</p>
              </ChartCard>

              <Button className="w-full" disabled={!allChecked || trips.length === 0 || savePlan.isPending} onClick={() => savePlan.mutate()}>
                {savePlan.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Sending to production...
                  </>
                ) : (
                  <>
                    <MessageSquare className="size-4" /> Send to production
                  </>
                )}
              </Button>
              {!allChecked && (
                <p className="text-center text-xs text-muted-foreground">Complete every verification item to continue.</p>
              )}
            </div>
          </div>
        )}
      </div>


      <Dialog open={sent} onOpenChange={setSent}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message sent (simulated)</DialogTitle>
            <DialogDescription>Production team notified with the trip plan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-xl border border-border bg-surface-raised p-3 text-sm">
            <p>
              <span className="text-muted-foreground">PO:</span> {po.poNumber}
            </p>
            <p>
              <span className="text-muted-foreground">Grade:</span> {po.grade}
            </p>
            <p>
              <span className="text-muted-foreground">Quantity:</span> {cum(planned)}
            </p>
            {trips.map((t, i) => (
              <p key={t.key} className="text-muted-foreground">
                Trip {i + 1}: {cum(t.quantity)} · {trucksQuery.data?.find((tm) => tm.id === t.tmId)?.tmNumber ?? "TM pending"} ·{" "}
                {driversQuery.data?.find((d) => d.id === t.driverId)?.name ?? "Driver pending"} · {t.plannedTime.slice(11, 16)}
              </p>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => void navigate({ to: "/dispatcher" })}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
