import { useState, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  HardHat,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Play,
  Square,
  Clock,
  MapPin,
  FileText,
  Phone,
  Gauge,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Printer
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { DataTable, type Column } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { LoadingState, ErrorState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tripsApi, type TripRow } from "@/api/trips";
import { useAuth } from "@/auth/auth-context";
import { cum, timeOnly } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/supervisor")({
  head: () => ({
    meta: [
      { title: "Site Supervisor Desk · RMC Command Center" },
      { name: "description", content: "Site truck arrival, concrete pump operations, quality checks, and delivery sign-offs." },
    ],
  }),
  component: SiteSupervisorPage,
});

function SiteSupervisorPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Pump status state (persisted in session)
  const [pumpRunning, setPumpRunning] = useState(true);
  const [pumpSpeed, setPumpSpeed] = useState("38 cum/hr");

  // Dialog states
  const [arrivalTrip, setArrivalTrip] = useState<TripRow | null>(null);
  const [arrivalNote, setArrivalNote] = useState("");

  const [issueTrip, setIssueTrip] = useState<TripRow | null>(null);
  const [issueType, setIssueType] = useState("Pump Line Choke / Breakdown");
  const [issueDetails, setIssueDetails] = useState("");

  const [deliverTrip, setDeliverTrip] = useState<TripRow | null>(null);
  const [deliveredQty, setDeliveredQty] = useState("");
  const [receiverName, setReceiverName] = useState("Site Engineer");

  const { data: allTrips, isLoading, error, refetch } = useQuery({
    queryKey: ["supervisor-trips"],
    queryFn: () => tripsApi.list().then((r) => r.data),
    refetchInterval: 10000,
  });

  // Categorize trips for site supervision
  const inTransitTrips = useMemo(() => {
    if (!allTrips) return [];
    return allTrips.filter((t) => ["DISPATCHED", "IN_TRANSIT"].includes(t.status));
  }, [allTrips]);

  const atSiteTrips = useMemo(() => {
    if (!allTrips) return [];
    // Trips that arrived or in transit can be unloaded
    return allTrips.filter((t) => t.status === "IN_TRANSIT" || (t.status === "DISPATCHED" && t.notes?.includes("Site Arrival")));
  }, [allTrips]);

  const completedTrips = useMemo(() => {
    if (!allTrips) return [];
    return allTrips.filter((t) => t.status === "DELIVERED").slice(0, 15);
  }, [allTrips]);

  // Mutations
  const arrive = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => tripsApi.arriveSite(id, notes),
    onSuccess: () => {
      toast.success("TM arrival recorded at site gate");
      setArrivalTrip(null);
      setArrivalNote("");
      void qc.invalidateQueries({ queryKey: ["supervisor-trips"] });
      void qc.invalidateQueries({ queryKey: ["trips-list"] });
    },
    onError: () => toast.error("Could not record arrival"),
  });

  const report = useMutation({
    mutationFn: ({ id, type, details }: { id: string; type: string; details: string }) =>
      tripsApi.reportSiteIssue(id, type, details),
    onSuccess: (res) => {
      toast.warning(res.message || "Site problem reported to Dispatch desk");
      setIssueTrip(null);
      setIssueDetails("");
      void qc.invalidateQueries({ queryKey: ["supervisor-trips"] });
    },
    onError: () => toast.error("Could not report issue"),
  });

  const deliver = useMutation({
    mutationFn: ({ id, qty, receiver }: { id: string; qty: number; receiver: string }) =>
      tripsApi.deliver(
        id,
        { deliveredQuantity: qty, receiverName: receiver, deliveryTime: new Date().toISOString() },
        user?.name ?? "Site Supervisor"
      ),
    onSuccess: () => {
      toast.success("Unloading complete! Delivery sign-off recorded");
      setDeliverTrip(null);
      setDeliveredQty("");
      void qc.invalidateQueries({ queryKey: ["supervisor-trips"] });
      void qc.invalidateQueries({ queryKey: ["trips-list"] });
    },
    onError: () => toast.error("Could not complete delivery"),
  });

  if (isLoading) return <LoadingState rows={6} />;
  if (error || !allTrips) return <ErrorState message="Could not load site trips." onRetry={() => void refetch()} />;

  const inTransitColumns: Column<TripRow>[] = [
    { key: "trip", header: "Trip #", cell: (r) => <span className="font-semibold">{r.tripNumber}</span> },
    { key: "po", header: "PO / Customer", cell: (r) => <span>{r.poNumber} · <span className="text-muted-foreground">{r.customerName}</span></span> },
    { key: "tm", header: "Transit Mixer", cell: (r) => <span className="font-medium text-primary">{r.tmCode}</span> },
    { key: "driver", header: "Driver", cell: (r) => <span>{r.driverName}</span> },
    { key: "grade", header: "Grade / Qty", align: "right", cell: (r) => <span className="font-medium">{r.grade} ({cum(r.quantity)})</span> },
    { key: "status", header: "Status", align: "center", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "Site Action",
      align: "right",
      cell: (r) => (
        <div className="flex justify-end gap-1.5">
          <Button
            size="sm"
            className="gap-1.5 bg-lime-600 hover:bg-lime-700 text-white font-semibold text-xs h-8"
            onClick={() => {
              setArrivalTrip(r);
              setArrivalNote("Arrived at site gate. Directing to pump line.");
            }}
          >
            <MapPin className="size-3.5" /> TM Reached
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8"
            onClick={() => void navigate({ to: `/challan/${r.id}?from=supervisor` as any })}
          >
            Challan
          </Button>
        </div>
      ),
    },
  ];

  const unloadingColumns: Column<TripRow>[] = [
    { key: "trip", header: "Trip #", cell: (r) => <span className="font-semibold">{r.tripNumber}</span> },
    { key: "site", header: "Site / Customer", cell: (r) => <div><p className="font-medium">{r.siteName}</p><p className="text-xs text-muted-foreground">{r.customerName}</p></div> },
    { key: "tm", header: "Transit Mixer", cell: (r) => <span className="font-medium text-primary">{r.tmCode}</span> },
    { key: "grade", header: "Grade", cell: (r) => <Badge variant="outline">{r.grade}</Badge> },
    { key: "qty", header: "Volume", align: "right", cell: (r) => cum(r.quantity) },
    {
      key: "notes",
      header: "Site Log",
      cell: (r) => (
        <span className={cn("text-xs line-clamp-1", r.notes?.includes("ISSUE") ? "text-rose-400 font-semibold" : "text-muted-foreground")}>
          {r.notes || "Ready for unloading"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Pour Control",
      align: "right",
      cell: (r) => (
        <div className="flex justify-end gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10 gap-1 text-xs h-8"
            onClick={() => {
              setIssueTrip(r);
              setIssueDetails("");
            }}
          >
            <ShieldAlert className="size-3.5" /> Report Problem
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8 gap-1.5"
            onClick={() => {
              setDeliverTrip(r);
              setDeliveredQty(String(r.quantity));
            }}
          >
            <CheckCircle2 className="size-3.5" /> Unload & Deliver
          </Button>
        </div>
      ),
    },
  ];

  const completedColumns: Column<TripRow>[] = [
    { key: "trip", header: "Trip #", cell: (r) => <span className="font-semibold">{r.tripNumber}</span> },
    { key: "challan", header: "Challan #", cell: (r) => <span className="font-medium text-primary">{r.challanNumber || "Released"}</span> },
    { key: "customer", header: "Customer / Site", cell: (r) => <span>{r.customerName} · {r.siteName}</span> },
    { key: "grade", header: "Grade", cell: (r) => r.grade },
    { key: "qty", header: "Delivered", align: "right", cell: (r) => cum(r.deliveredQuantity ?? r.quantity) },
    { key: "receiver", header: "Signed By", cell: (r) => r.receiverName || "Site Engineer" },
    {
      key: "action",
      header: "Challan",
      align: "right",
      cell: (r) => (
        <Button
          size="sm"
          variant="ghost"
          className="text-xs h-7 gap-1"
          onClick={() => void navigate({ to: `/challan/${r.id}?from=supervisor` as any })}
        >
          <Printer className="size-3" /> View Challan
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Site Supervisor Command Desk"
        subtitle="Real-time site pour control: transit mixer arrival, boom pump operations, problem escalations, and digital delivery sign-offs"
      />

      {/* Top Site & Pump Telemetry Header */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Gauge className="size-4 text-primary" /> Concrete Pump
            </span>
            <Badge variant="outline" className={cn("text-[10px] font-bold", pumpRunning ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-rose-500/15 text-rose-400 border-rose-500/30")}>
              {pumpRunning ? "RUNNING (ON)" : "STOPPED (OFF)"}
            </Badge>
          </div>
          <div className="flex items-center justify-between pt-1">
            <div>
              <p className="text-base font-bold text-foreground">Putzmeister 60m</p>
              <p className="text-xs text-muted-foreground">Speed: {pumpSpeed} · Line: 75 bar</p>
            </div>
            <Switch
              checked={pumpRunning}
              onCheckedChange={(checked) => {
                setPumpRunning(checked);
                toast(checked ? "Concrete Pump STARTED (ON)" : "Concrete Pump STOPPED (OFF)");
              }}
            />
          </div>
        </div>

        <KpiCard
          label="TMs In Transit"
          value={String(inTransitTrips.length)}
          icon={Truck}
          comparison="Approaching site gate"
        />

        <KpiCard
          label="Active Pours at Site"
          value={String(atSiteTrips.length)}
          icon={HardHat}
          comparison="Pouring into pump hopper"
        />

        <KpiCard
          label="Pours Completed Today"
          value={String(completedTrips.length)}
          icon={CheckCircle2}
          comparison="Delivered & signed off"
        />
      </div>

      {/* Section 1: Trucks In-Transit Arriving to Site */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <Truck className="size-4 text-sky-400" /> Incoming Transit Mixers (In Transit)
            </h2>
            <Badge variant="outline" className="text-[10px] font-bold text-sky-400 border-sky-500/30 bg-sky-500/10">
              {inTransitTrips.length} en route
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">Click "TM Reached" upon gate arrival</span>
        </div>

        <DataTable
          columns={inTransitColumns}
          rows={inTransitTrips}
          rowKey={(r) => r.id}
          emptyTitle="No trucks currently in transit to site"
          emptyDescription="Trips dispatched from the plant will appear here with live ETA."
        />
      </section>

      {/* Section 2: Concrete Unloading & Pump Station */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <HardHat className="size-4 text-lime-400" /> Site Pouring & Unloading Operations
            </h2>
            <Badge variant="outline" className="text-[10px] font-bold text-lime-400 border-lime-500/30 bg-lime-500/10">
              {atSiteTrips.length} at site
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">Direct TM into pump hopper · Report any delays</span>
        </div>

        <DataTable
          columns={unloadingColumns}
          rows={atSiteTrips}
          rowKey={(r) => r.id}
          emptyTitle="No transit mixers currently pouring at site"
          emptyDescription="Mark arriving trucks as Reached above to begin unloading."
        />
      </section>

      {/* Section 3: Today's Delivery Sign-offs */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="size-4 text-emerald-400" /> Today's Completed Concrete Deliveries
          </h2>
          <span className="text-xs text-muted-foreground">{completedTrips.length} trips signed off</span>
        </div>

        <DataTable
          columns={completedColumns}
          rows={completedTrips}
          rowKey={(r) => r.id}
          emptyTitle="No completed deliveries yet"
          emptyDescription="Delivered trips with customer signatures will appear here."
        />
      </section>

      {/* TM Arrival Dialog */}
      <Dialog open={arrivalTrip !== null} onOpenChange={(open) => !open && setArrivalTrip(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm TM Arrival at Site Gate</DialogTitle>
            <DialogDescription>
              {arrivalTrip?.tripNumber} · TM {arrivalTrip?.tmCode} · Driver: {arrivalTrip?.driverName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="arr-notes">Site Arrival Notes</Label>
              <Input
                id="arr-notes"
                value={arrivalNote}
                onChange={(e) => setArrivalNote(e.target.value)}
                placeholder="e.g. Gate pass verified. Directing to Putzmeister pump."
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Recording arrival informs the plant dispatcher and customer portal that the transit mixer has reached the site safely.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setArrivalTrip(null)}>Cancel</Button>
            <Button
              className="bg-lime-600 hover:bg-lime-700 text-white font-semibold"
              disabled={arrive.isPending}
              onClick={() => arrivalTrip && arrive.mutate({ id: arrivalTrip.id, notes: arrivalNote })}
            >
              {arrive.isPending ? "Confirming..." : "Confirm Arrival"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Problem Reporting Dialog */}
      <Dialog open={issueTrip !== null} onOpenChange={(open) => !open && setIssueTrip(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-500">
              <AlertTriangle className="size-5" /> Report Site / Pour Problem
            </DialogTitle>
            <DialogDescription>
              Immediately escalates issues to Dispatch Control and Plant Operations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="issue-type">Issue Category</Label>
              <Select value={issueType} onValueChange={setIssueType}>
                <SelectTrigger id="issue-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pump Line Choke / Breakdown">Pump Line Choke / Breakdown</SelectItem>
                  <SelectItem value="Site Shuttering Issue / Pour Delay">Site Shuttering Issue / Pour Delay</SelectItem>
                  <SelectItem value="Concrete Slump / Quality Deviation">Concrete Slump / Quality Deviation</SelectItem>
                  <SelectItem value="Site Access Blocked / Heavy Traffic">Site Access Blocked / Heavy Traffic</SelectItem>
                  <SelectItem value="Customer Requested Hold">Customer Requested Hold</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="issue-det">Problem Details & Impact</Label>
              <Input
                id="issue-det"
                value={issueDetails}
                onChange={(e) => setIssueDetails(e.target.value)}
                placeholder="e.g. Pump line choke at bend #3. Clearing line, delay 20 mins."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueTrip(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={report.isPending}
              onClick={() => issueTrip && report.mutate({ id: issueTrip.id, type: issueType, details: issueDetails })}
            >
              {report.isPending ? "Reporting..." : "Escalate to Plant Dispatch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unload & Deliver Confirmation Dialog */}
      <Dialog open={deliverTrip !== null} onOpenChange={(open) => !open && setDeliverTrip(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Pour & Customer Delivery Sign-off</DialogTitle>
            <DialogDescription>
              {deliverTrip?.tripNumber} · {deliverTrip?.customerName} · {deliverTrip?.siteName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="del-qty">Delivered Concrete Volume (cum)</Label>
              <Input
                id="del-qty"
                value={deliveredQty}
                onChange={(e) => setDeliveredQty(e.target.value)}
                inputMode="decimal"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="del-rec">Customer Site Engineer / Receiver Name</Label>
              <Input
                id="del-rec"
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                placeholder="e.g. Er. Nilesh Shinde"
              />
            </div>

            <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Immediate Effects of Sign-off:</p>
              <p>• TM {deliverTrip?.tmCode} will be marked AVAILABLE and freed to return to plant.</p>
              <p>• Delivery Challan release status verified.</p>
              <p>• PO delivered volume updated; invoice will be queued in Accounts.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliverTrip(null)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              disabled={!deliveredQty || !receiverName || deliver.isPending}
              onClick={() =>
                deliverTrip &&
                deliver.mutate({
                  id: deliverTrip.id,
                  qty: Number(deliveredQty),
                  receiver: receiverName,
                })
              }
            >
              {deliver.isPending ? "Confirming..." : "Confirm Delivery Sign-off"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
