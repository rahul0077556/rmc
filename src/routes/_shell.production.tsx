import { useState, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Factory, Layers, PackageCheck, Timer } from "lucide-react";
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

  const { params, updateParams, query: queue } = useListQuery(["production-queue"], () => productionApi.queue().then((r) => r.data));
  const materials = useQuery({
    queryKey: ["material-check", active?.id],
    queryFn: () => productionApi.materialCheck(active!.id).then((r) => r.data),
    enabled: active !== null,
  });

  const start = useMutation({
    mutationFn: (id: string) => productionApi.startBatching(id, user?.name ?? "Production"),
    onSuccess: (res) => {
      toast.success("Batching started");
      setActive(res.data);
      void qc.invalidateQueries({ queryKey: ["production-queue"] });
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
  });

  const send = useMutation({
    mutationFn: (id: string) => tripsApi.setStatus(id, "SENT_TO_PRODUCTION", user?.name ?? "Production"),
    onSuccess: () => {
      toast.success("Trip moved into the production queue");
      void qc.invalidateQueries({ queryKey: ["production-queue"] });
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
        <div className="flex justify-end gap-1.5">
          {r.status === "PLANNED" && !readOnly && (
            <Button size="sm" variant="outline" onClick={() => send.mutate(r.id)}>
              Accept
            </Button>
          )}
          {["SENT_TO_PRODUCTION", "BATCHING", "LOADED"].includes(r.status) && !readOnly && (
            <Button size="sm" onClick={() => setActive(r)}>
              Open
            </Button>
          )}
          {r.status === "QC_PENDING" && r.batchSheetId && (
            <Button size="sm" variant="ghost" onClick={() => void navigate({ to: "/batch-sheet/$id", params: { id: r.batchSheetId! } })}>
              Batch sheet
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Production Queue" subtitle="Material readiness, batching and batch sheet generation" />

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

          {materials.isLoading && <LoadingState rows={3} />}

          {materials.data && (
            <>
              {shortfalls.length > 0 && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Batching blocked — insufficient {shortfalls[0]!.material} by {num(shortfalls[0]!.shortfall)}{" "}
                    {shortfalls[0]!.unit}.
                  </span>
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)}>
              Close
            </Button>
            {active?.status !== "BATCHING" && (
              <Button disabled={shortfalls.length > 0 || !active} onClick={() => active && start.mutate(active.id)}>
                Start batching
              </Button>
            )}
            {active?.status === "BATCHING" && (
              <Button onClick={() => active && confirm.mutate(active.id)} disabled={confirm.isPending}>
                Confirm loaded quantity
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
