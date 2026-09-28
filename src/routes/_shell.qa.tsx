import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, CircleX, FlaskConical, RefreshCcw, Timer, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { ChartCard } from "@/components/app/chart-card";
import { DataTable, type Column } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { LoadingState, ErrorState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { qaApi, type QcInput, type QcQueueRow } from "@/api/qa";
import { useAuth } from "@/auth/auth-context";
import { SLUMP_TARGET } from "@/lib/mock-data";
import { cum } from "@/lib/format";
import type { CubeTest, Grade, MaterialTest } from "@/types";

export const Route = createFileRoute("/_shell/qa")({
  head: () => ({
    meta: [
      { title: "Quality Control · RMC Command Center" },
      { name: "description", content: "Inspect batches, record slump, approve trips and track cube testing." },
      { property: "og:title", content: "Quality Control · RMC Command Center" },
      { property: "og:description", content: "Inspect batches, record slump, approve trips and track cube testing." },
    ],
  }),
  component: QaPage,
});

const EMPTY: QcInput = {
  physicalInspection: "PASS",
  slump: 120,
  bleeding: "PASS",
  wrongMix: "PASS",
  admixtureType: "Polycarboxylate ether",
  admixtureQuantity: 2.4,
  remarks: "",
  decision: "APPROVED",
};

function QaPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [active, setActive] = useState<QcQueueRow | null>(null);
  const [form, setForm] = useState<QcInput>(EMPTY);
  const [cubeTarget, setCubeTarget] = useState<CubeTest | null>(null);
  const [strength, setStrength] = useState("");

  const summary = useQuery({ queryKey: ["qa-summary"], queryFn: () => qaApi.summary().then((r) => r.data) });
  const queue = useQuery({ queryKey: ["qa-queue"], queryFn: () => qaApi.queue().then((r) => r.data) });
  const cubes = useQuery({ queryKey: ["cube-tests"], queryFn: () => qaApi.cubeTests().then((r) => r.data) });
  const matTests = useQuery({ queryKey: ["material-tests"], queryFn: () => qaApi.materialTests().then((r) => r.data) });

  const submit = useMutation({
    mutationFn: (input: { batchSheetId: string; data: QcInput }) =>
      qaApi.submitCheck(input.batchSheetId, input.data, user?.name ?? "QA"),
    onSuccess: (res) => {
      toast.success(res.message ?? "QC recorded");
      setActive(null);
      setForm(EMPTY);
      void qc.invalidateQueries();
    },
  });

  const recordCube = useMutation({
    mutationFn: (input: { id: string; strength: number }) =>
      qaApi.recordCube(input.id, input.strength, user?.name ?? "QA"),
    onSuccess: () => {
      toast.success("Cube test recorded");
      setCubeTarget(null);
      setStrength("");
      void qc.invalidateQueries({ queryKey: ["cube-tests"] });
    },
  });

  if (summary.isLoading || queue.isLoading) return <LoadingState rows={6} />;
  if (summary.error || !summary.data || !queue.data)
    return <ErrorState message="Quality data could not be loaded." onRetry={() => void summary.refetch()} />;

  const grade = (active?.trip.grade ?? "M25") as Grade;
  const target = SLUMP_TARGET[grade];
  const slumpOk = form.slump >= target[0] && form.slump <= target[1];

  const queueColumns: Column<QcQueueRow>[] = [
    { key: "bs", header: "Batch Sheet", cell: (r) => <span className="font-medium">{r.batchSheetId}</span> },
    { key: "trip", header: "Trip", cell: (r) => r.trip.tripNumber },
    { key: "po", header: "PO", cell: (r) => r.trip.poNumber },
    { key: "customer", header: "Customer", cell: (r) => r.trip.customerName },
    { key: "grade", header: "Grade", cell: (r) => r.trip.grade },
    { key: "qty", header: "Quantity", align: "right", cell: (r) => cum(r.trip.quantity) },
    { key: "status", header: "Status", align: "center", cell: (r) => <StatusBadge status={r.trip.status} /> },
    {
      key: "action",
      header: "Action",
      align: "right",
      cell: (r) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => void navigate({ to: "/batch-sheet/$id", params: { id: r.batchSheetId } })}>
            Sheet
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setActive(r);
              setForm({ ...EMPTY, slump: SLUMP_TARGET[r.trip.grade as Grade][0] + 20 });
            }}
          >
            Inspect
          </Button>
        </div>
      ),
    },
  ];

  const cubeColumns: Column<CubeTest>[] = [
    { key: "bs", header: "Batch Sheet", cell: (r) => r.batchSheetId },
    { key: "grade", header: "Grade", cell: (r) => r.grade },
    { key: "cast", header: "Cast Date", cell: (r) => r.castDate },
    { key: "age", header: "Test Age", cell: (r) => `${r.age} day` },
    { key: "due", header: "Due Date", cell: (r) => r.dueDate, sortValue: (r) => r.dueDate },
    { key: "tested", header: "Tested On", cell: (r) => r.testedOn ?? "—" },
    { key: "strength", header: "Strength (MPa)", align: "right", cell: (r) => r.strength ?? "—" },
    { key: "result", header: "Result", align: "center", cell: (r) => <StatusBadge status={r.result} /> },
    {
      key: "action",
      header: "Action",
      align: "right",
      cell: (r) =>
        r.result === "PENDING" || r.result === "OVERDUE" ? (
          <Button size="sm" variant="outline" onClick={() => setCubeTarget(r)}>
            Record
          </Button>
        ) : null,
    },
  ];

  const matColumns: Column<MaterialTest>[] = [
    { key: "material", header: "Material", cell: (r) => r.material },
    { key: "test", header: "Test", cell: (r) => r.test },
    { key: "result", header: "Result", cell: (r) => r.result },
    { key: "date", header: "Test Date", cell: (r) => r.testDate, sortValue: (r) => r.testDate },
    { key: "remarks", header: "Remarks", cell: (r) => <span className="text-muted-foreground">{r.remarks}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Quality Control" subtitle="Batch inspection, slump verification and cube testing" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="QC pending" value={String(summary.data.pending)} icon={Timer} />
        <KpiCard label="Approved" value={String(summary.data.approved)} icon={BadgeCheck} />
        <KpiCard label="Rejected" value={String(summary.data.rejected)} icon={CircleX} />
        <KpiCard label="Recheck required" value={String(summary.data.recheck)} icon={RefreshCcw} />
        <KpiCard label="Cube tests due" value={String(summary.data.cubeDue)} icon={FlaskConical} />
        <KpiCard label="Overdue tests" value={String(summary.data.overdue)} icon={TriangleAlert} />
      </div>

      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">Inspection queue</TabsTrigger>
          <TabsTrigger value="cubes">Cube testing</TabsTrigger>
          <TabsTrigger value="materials">Material testing</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-4">
          <DataTable
            columns={queueColumns}
            rows={queue.data}
            rowKey={(r) => r.batchSheetId}
            emptyTitle="No batches awaiting inspection"
            emptyDescription="Batch sheets arrive here as soon as production confirms a load."
          />
        </TabsContent>

        <TabsContent value="cubes" className="mt-4">
          <DataTable
            columns={cubeColumns}
            rows={cubes.data ?? []}
            rowKey={(r) => r.id}
            loading={cubes.isLoading}
            emptyTitle="No cube sets cast yet"
            emptyDescription="Cube sets are created automatically when a batch is approved."
          />
        </TabsContent>

        <TabsContent value="materials" className="mt-4">
          <DataTable
            columns={matColumns}
            rows={matTests.data ?? []}
            rowKey={(r) => r.id}
            loading={matTests.isLoading}
            emptyTitle="No material tests logged"
            emptyDescription="Cement fineness, sand moisture and aggregate tests appear here."
          />
        </TabsContent>
      </Tabs>

      <Dialog open={active !== null} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Quality check · {active?.batchSheetId}</DialogTitle>
            <DialogDescription>
              {active?.trip.tripNumber} · {active?.trip.customerName} · {grade} · {active && cum(active.trip.quantity)}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["physicalInspection", "Physical inspection"],
                ["bleeding", "Bleeding"],
                ["wrongMix", "Wrong mix"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs">{label}</Label>
                <Select value={form[key]} onValueChange={(v) => setForm((f) => ({ ...f, [key]: v as "PASS" | "FAIL" }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PASS">Pass</SelectItem>
                    <SelectItem value="FAIL">Fail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}

            <div className="space-y-1.5">
              <Label className="text-xs">
                Slump (mm) · target {target[0]}–{target[1]}
              </Label>
              <Input
                value={form.slump}
                inputMode="numeric"
                onChange={(e) => setForm((f) => ({ ...f, slump: Number(e.target.value) || 0 }))}
              />
              <p className={slumpOk ? "text-xs text-success" : "text-xs text-warning"}>
                {slumpOk ? "Within target range" : "Outside the target range for this grade"}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Admixture type</Label>
              <Input value={form.admixtureType} onChange={(e) => setForm((f) => ({ ...f, admixtureType: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Admixture quantity (kg)</Label>
              <Input
                value={form.admixtureQuantity}
                inputMode="decimal"
                onChange={(e) => setForm((f) => ({ ...f, admixtureQuantity: Number(e.target.value) || 0 }))}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Remarks</Label>
              <Textarea
                rows={3}
                value={form.remarks}
                onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                placeholder="Observations during inspection"
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() =>
                active &&
                submit.mutate({
                  batchSheetId: active.batchSheetId,
                  data: { ...form, decision: "REJECTED", rejectionAction: "CORRECT" },
                })
              }
            >
              Reject — correct
            </Button>
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() =>
                active &&
                submit.mutate({
                  batchSheetId: active.batchSheetId,
                  data: { ...form, decision: "REJECTED", rejectionAction: "REPLACE" },
                })
              }
            >
              Reject — replace TM
            </Button>
            <Button onClick={() => active && submit.mutate({ batchSheetId: active.batchSheetId, data: { ...form, decision: "APPROVED" } })}>
              Approve batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cubeTarget !== null} onOpenChange={(open) => !open && setCubeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record cube strength</DialogTitle>
            <DialogDescription>
              {cubeTarget?.batchSheetId} · {cubeTarget?.grade} · {cubeTarget?.age} day test
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="strength">Compressive strength (MPa)</Label>
            <Input id="strength" value={strength} inputMode="decimal" onChange={(e) => setStrength(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCubeTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={!strength}
              onClick={() => cubeTarget && recordCube.mutate({ id: cubeTarget.id, strength: Number(strength) })}
            >
              Save result
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
