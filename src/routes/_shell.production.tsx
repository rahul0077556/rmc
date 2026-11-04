import { useState, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Factory, Layers, PackageCheck, Timer, Upload, Printer, Scale, FileText, CheckCircle2 } from "lucide-react";
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
import { productionApi } from "@/api/production";
import { tripsApi, type TripRow } from "@/api/trips";
import { useAuth } from "@/auth/auth-context";
import { cum, num, timeOnly } from "@/lib/format";
import { UploadBatchSheetDialog } from "@/components/production/UploadBatchSheetDialog";
import { DailyConsumptionDialog } from "@/components/production/DailyConsumptionDialog";

export const Route = createFileRoute("/_shell/production")({
  head: () => ({
    meta: [
      { title: "Production Queue · RMC Command Center" },
      { name: "description", content: "Check materials, run batching and generate batch sheets for each trip." },
    ],
  }),
  component: ProductionPage,
});

function ProductionPage() {
  const { user } = useAuth();
  const readOnly = user?.role === "owner";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [active, setActive] = useState<TripRow | null>(null);
  const [selectedTripForUpload, setSelectedTripForUpload] = useState<TripRow | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [consumptionOpen, setConsumptionOpen] = useState(false);

  const { params, updateParams, query: queue } = useListQuery(["production-queue"], () => productionApi.queue().then((r) => r.data));
  const materials = useQuery({
    queryKey: ["material-check", active?.id],
    queryFn: () => productionApi.materialCheck(active!.id).then((r) => r.data),
    enabled: active !== null,
  });

  const start = useMutation({
    mutationFn: (id: string) => productionApi.startBatching(id, user?.name ?? "Production"),
    onSuccess: (res) => {
      toast.success("Batching started in plant");
      const updatedTrip = (res.data as any)?.trip || res.data;
      if (updatedTrip) {
        setActive(updatedTrip);
      }
      void qc.invalidateQueries({ queryKey: ["production-queue"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || err?.message || "Failed to start batching");
    },
  });

  const confirm = useMutation({
    mutationFn: (id: string) => productionApi.confirmLoaded(id, user?.name ?? "Production"),
    onSuccess: (res) => {
      toast.success("Batch sheet generated");
      setActive(null);
      void qc.invalidateQueries({ queryKey: ["production-queue"] });
      void qc.invalidateQueries({ queryKey: ["qa-queue"] });
      if (res.data) void navigate({ to: "/batch-sheet/$id", params: { id: res.data.id } });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || err?.message || "Failed to generate batch sheet");
    },
  });

  const send = useMutation({
    mutationFn: (id: string) => tripsApi.setStatus(id, "SENT_TO_PRODUCTION", user?.name ?? "Production"),
    onSuccess: () => {
      toast.success("Trip moved into the production queue");
      void qc.invalidateQueries({ queryKey: ["production-queue"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || err?.message || "Failed to move trip to production");
    },
  });

  const filteredQueue = useMemo(() => {
    if (!queue.data) return [];
    let list = queue.data;
    if (params.q) {
      const lower = params.q.toLowerCase();
      list = list.filter((i) => i.poNumber.toLowerCase().includes(lower) || i.customerName.toLowerCase().includes(lower) || i.tripNumber.toLowerCase().includes(lower));
    }
    return list;
  }, [queue.data, params]);

  if (queue.isLoading) return <LoadingState rows={6} />;
  if (queue.error || !queue.data) return <ErrorState message="The production queue could not be loaded." onRetry={() => void queue.refetch()} />;

  const rows = queue.data;
  const count = (s: TripRow["status"][]) => rows.filter((t) => s.includes(t.status)).length;
  const shortfalls = (materials.data ?? []).filter((m) => !m.sufficient);

  const columns: Column<TripRow>[] = [
    { key: "trip", header: "Trip", cell: (r) => <span className="font-medium">{r.tripNumber}</span> },
    { key: "po", header: "PO", cell: (r) => r.poNumber },
    { key: "customer", header: "Customer", cell: (r) => r.customerName },
    { key: "grade", header: "Grade", cell: (r) => r.grade },
    { key: "qty", header: "Quantity", align: "right", cell: (r) => cum(r.quantity), sortValue: (r) => r.quantity },
    { key: "tm", header: "TM / Driver", cell: (r) => `${r.tmCode} · ${r.driverName}` },
    { key: "time", header: "Planned", cell: (r) => timeOnly(r.plannedTime) },
    { key: "status", header: "Status", align: "center", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "action",
      header: "Action",
      align: "right",
      cell: (r) => (
        <div className="flex items-center justify-end gap-1.5 flex-wrap">
          {r.batchSheetId ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 border-primary/40 text-primary hover:bg-primary/10 cursor-pointer text-xs"
              onClick={() => void navigate({ to: "/batch-sheet/$id", params: { id: r.batchSheetId! } })}
            >
              <FileText className="size-3.5" />
              Batch sheet
            </Button>
          ) : (
            <>
              {r.status === "PLANNED" && !readOnly ? (
                <Button size="sm" variant="outline" onClick={() => send.mutate(r.id)}>
                  Accept
                </Button>
              ) : ["SENT_TO_PRODUCTION", "BATCHING"].includes(r.status) && !readOnly ? (
                <Button size="sm" onClick={() => setActive(r)}>
                  {r.status === "BATCHING" ? "Continue batch" : "Start batch"}
                </Button>
              ) : null}

              {!readOnly && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 border-amber-500/40 text-amber-500 hover:bg-amber-500/10 cursor-pointer text-xs font-medium"
                  onClick={() => {
                    setSelectedTripForUpload(r);
                    setUploadOpen(true);
                  }}
                  title={`Upload printed plant batch sheet for ${r.tripNumber}`}
                >
                  <Upload className="size-3.5" />
                  Upload Batch Sheet
                </Button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Queue"
        subtitle="Material readiness, batching and batch sheet generation"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConsumptionOpen(true)}
              className="text-xs gap-1.5 cursor-pointer"
            >
              <Printer className="size-3.5 text-primary" />
              Daily Consumption & Print
            </Button>
            {!readOnly && (
              <Button
                size="sm"
                onClick={() => {
                  setSelectedTripForUpload(null);
                  setUploadOpen(true);
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold gap-1.5 cursor-pointer"
              >
                <Upload className="size-3.5" />
                + Upload / Scan Batch Sheet
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Waiting" value={String(count(["PLANNED", "SENT_TO_PRODUCTION"]))} icon={Timer} comparison="queued for batching" />
        <KpiCard label="Batching" value={String(count(["BATCHING"]))} icon={Factory} comparison="in the plant now" />
        <KpiCard label="Loaded" value={String(count(["LOADED"]))} icon={Layers} comparison="awaiting confirmation" />
        <KpiCard label="QC pending" value={String(count(["QC_PENDING"]))} icon={PackageCheck} comparison="sent to quality" />
      </div>

      <FilterBar
        search={params.q}
        onSearchChange={(q) => updateParams({ q })}
        searchPlaceholder="Search PO, Trip or Customer..."
      />

      <DataTable
        columns={columns}
        rows={filteredQueue}
        rowKey={(r) => r.id}
        initialPageSize={10}
        emptyTitle="Nothing queued for production"
        emptyDescription="Trips appear here once dispatch sends a plan to production."
      />

      <Dialog open={active !== null} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {active?.tripNumber} · {active?.grade}
            </DialogTitle>
            <DialogDescription>
              {active?.customerName} · {active && cum(active.quantity)} · {active?.tmCode} · {active?.driverName}
            </DialogDescription>
          </DialogHeader>

          {active?.batchSheetId ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center space-y-2">
              <CheckCircle2 className="size-8 text-emerald-500 mx-auto" />
              <div className="text-sm font-semibold text-emerald-400">
                Batch Sheet Generated
              </div>
              <p className="text-xs text-muted-foreground">
                This trip has already completed plant batching. All materials were deducted from silo inventory.
              </p>
            </div>
          ) : (
            <>
              {active?.status === "BATCHING" && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Factory className="size-4 text-amber-500 animate-pulse" />
                    <span className="font-semibold text-foreground">
                      Auto AJAX Batching in progress — Scale weighments active
                    </span>
                  </div>
                  <span className="font-mono text-emerald-400 font-bold">Ready to Load</span>
                </div>
              )}

              {materials.isLoading && <LoadingState rows={3} />}

              {materials.data && (
                <>
                  {shortfalls.length > 0 && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                      <AlertTriangle className="mt-0.5 size-4 text-amber-500 shrink-0" />
                      <div className="space-y-0.5">
                        <span className="font-bold">Stock Warning:</span>
                        <p>
                          Low stock for {shortfalls.map((s) => `${s.material} (need ${num(s.shortfall)} ${s.unit})`).join(", ")}.
                          Per plant policy, physically batched loads are never blocked; consumption will be recorded to the inventory ledger.
                        </p>
                      </div>
                    </div>
                  )}

                  <ChartCard title="Material check" description="Mix design requirement against plant stock" bodyClassName="p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                          <th className="border-b border-border px-4 py-2 text-left">Material</th>
                          <th className="border-b border-border px-4 py-2 text-right">Required</th>
                          <th className="border-b border-border px-4 py-2 text-right">Available</th>
                          <th className="border-b border-border px-4 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materials.data.map((m) => (
                          <tr key={m.material} className="border-b border-border/60 last:border-0">
                            <td className="px-4 py-2">{m.material}</td>
                            <td className="px-4 py-2 text-right tabular-nums">
                              {num(m.required)} {m.unit}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                              {num(m.available)} {m.unit}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <StatusBadge status={m.sufficient ? "AVAILABLE" : "INSUFFICIENT"} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ChartCard>
                </>
              )}
            </>
          )}

          <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
            <Button variant="outline" onClick={() => setActive(null)}>
              Close
            </Button>
            <div className="flex items-center gap-2">
              {!readOnly && !active?.batchSheetId && (
                <Button
                  variant="outline"
                  className="gap-1.5 border-amber-500/40 text-amber-500 hover:bg-amber-500/10 cursor-pointer"
                  onClick={() => {
                    const currentTrip = active;
                    setActive(null);
                    setSelectedTripForUpload(currentTrip);
                    setUploadOpen(true);
                  }}
                >
                  <Upload className="size-4" />
                  Upload Batch Sheet
                </Button>
              )}
              {active?.batchSheetId ? (
                <Button
                  onClick={() => {
                    const bId = active.batchSheetId!;
                    setActive(null);
                    void navigate({ to: "/batch-sheet/$id", params: { id: bId } });
                  }}
                >
                  View Batch Sheet
                </Button>
              ) : active?.status === "BATCHING" ? (
                <Button
                  onClick={() => active && confirm.mutate(active.id)}
                  disabled={confirm.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {confirm.isPending ? "Generating Sheet..." : "Confirm loaded quantity & Generate Sheet"}
                </Button>
              ) : (
                <Button
                  disabled={!active || start.isPending}
                  onClick={() => active && start.mutate(active.id)}
                >
                  {start.isPending ? "Starting batch..." : "Start batching"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload SCADA Batch Sheet Modal */}
      <UploadBatchSheetDialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open) setSelectedTripForUpload(null);
        }}
        trip={selectedTripForUpload}
        onSuccess={() => {
          setSelectedTripForUpload(null);
          void qc.invalidateQueries({ queryKey: ["production-queue"] });
        }}
      />

      {/* Daily Consumption & Batch Print Modal */}
      <DailyConsumptionDialog
        open={consumptionOpen}
        onOpenChange={setConsumptionOpen}
      />
    </div>
  );
}
