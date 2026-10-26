import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  Cell,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import {
  FlaskConical,
  Sparkles,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  Info,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  DollarSign,
  Filter,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getMixOptimizationData,
  GRADE_STRENGTH_STANDARDS,
  type BatchMixRecord,
} from "@/lib/mix-optimization-data";
import { inr, num } from "@/lib/format";
import { cn } from "@/lib/utils";

class SafeErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: any) {
    console.error("CRASH IN MixOptimizationMap:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div id="crash-debug-box" className="p-6 bg-red-950 border border-red-500 rounded-xl text-red-200 m-4">
          <h2 className="text-base font-bold text-red-400">Crash in MixOptimizationMap</h2>
          <pre className="mt-2 text-xs font-mono whitespace-pre-wrap">{this.state.error.message}</pre>
          <pre className="mt-2 text-[10px] font-mono whitespace-pre-wrap opacity-75">{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export function MixOptimizationMap() {
  return (
    <SafeErrorBoundary>
      <MixOptimizationMapContent />
    </SafeErrorBoundary>
  );
}

function MixOptimizationMapContent() {
  const { batches, summary } = useMemo(() => getMixOptimizationData(), []);

  // Filter State
  const [selectedGrade, setSelectedGrade] = useState<string>("ALL");
  const [onlySavings, setOnlySavings] = useState<boolean>(false);
  const [inspectBatch, setInspectBatch] = useState<BatchMixRecord | null>(null);

  // Filtered dataset
  const filteredBatches = useMemo(() => {
    let list = batches;
    if (selectedGrade !== "ALL") {
      list = list.filter((b) => b.grade === selectedGrade);
    }
    if (onlySavings) {
      list = list.filter((b) => b.status === "potential-saving");
    }
    return list;
  }, [batches, selectedGrade, onlySavings]);

  const activeGradeStd = selectedGrade !== "ALL" ? GRADE_STRENGTH_STANDARDS[selectedGrade as any] : null;

  return (
    <div className="rounded-xl border border-border bg-card shadow-md overflow-hidden space-y-0">
      {/* Header Bar */}
      <div className="border-b border-border bg-surface-raised/40 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
              <FlaskConical className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-foreground">
                  Mix Optimization Map (Cement vs. Strength)
                </h3>
                <Badge variant="outline" className="text-[11px] font-semibold border-indigo-500/30 text-indigo-500 bg-indigo-500/5">
                  IS 456 &amp; IS 10262 Advisory
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Scatter chart correlating cementitious content against 28-day cube strength achieved. Flagging overdesigned mixes for potential cement cost reduction.
              </p>
            </div>
          </div>

          {/* Action Filters */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger className="h-8 w-32 text-xs font-semibold bg-background">
                <SelectValue placeholder="Grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Grades</SelectItem>
                <SelectItem value="M20">M20 Grade</SelectItem>
                <SelectItem value="M25">M25 Grade</SelectItem>
                <SelectItem value="M30">M30 Grade</SelectItem>
                <SelectItem value="M35">M35 Grade</SelectItem>
                <SelectItem value="M40">M40 Grade</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={onlySavings ? "default" : "outline"}
              size="sm"
              onClick={() => setOnlySavings((prev) => !prev)}
              className={cn(
                "h-8 text-xs gap-1.5 font-medium transition-all",
                onlySavings && "bg-indigo-600 hover:bg-indigo-700 text-white"
              )}
            >
              <Sparkles className="size-3.5" />
              <span>Flagged Savings ({summary.savingsBatchesCount})</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-6">
        {/* ============================================================== */}
        {/* MANDATORY REGULATORY SAFETY NOTICE */}
        {/* ============================================================== */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 sm:p-4 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
          <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-sm text-foreground">
              Advisory QA Review Only · Mix Design Integrity Protected
            </p>
            <p className="leading-relaxed text-muted-foreground">
              Mix optimization opportunities are statistical suggestions under <strong>IS 10262:2019 Clause 5.2</strong> for the QA Technical Head to evaluate during periodic mix review. <strong>These suggestions NEVER alter production mix designs automatically</strong>. Concrete trial testing and structural consultant sign-off are required before updating batching recipes.
            </p>
          </div>
        </div>

        {/* ============================================================== */}
        {/* KPI SUMMARY CARDS */}
        {/* ============================================================== */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="panel p-4">
            <span className="text-xs text-muted-foreground">Batches Analyzed (28d)</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold font-mono text-foreground">
                {summary.totalBatches}
              </span>
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                100% CTM Tested
              </Badge>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Across M20, M25, M30, M35, M40</p>
          </div>

          <div className="panel p-4 border-indigo-500/20 bg-indigo-500/5">
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
              Over-Strength Batches (Savings)
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
                {summary.savingsBatchesCount}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({summary.savingsBatchesPercent}%)
                </span>
              </span>
              <span className="text-xs font-bold text-indigo-500 font-mono">
                +{summary.avgOverStrengthMpa} MPa
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Exceeds target mean strength (f_ck + 1.65s) by &gt;4.5 MPa
            </p>
          </div>

          <div className="panel p-4 border-emerald-500/20 bg-emerald-500/5">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              Avg. Cement Optimization
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                ~{summary.avgCementSavingKg} <span className="text-sm font-normal">kg/cum</span>
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                ₹{summary.avgRupeeSavingPerCum} / cum
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Based on OPC 53 @ ₹7.50/kg with fly ash blending
            </p>
          </div>

          <div className="panel p-4 border-primary/20 bg-primary/5">
            <span className="text-xs text-primary font-semibold">
              Potential Monthly Savings
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold font-mono text-primary">
                {inr(summary.potentialMonthlySavingInr)}
              </span>
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                2,400 cum/mo
              </Badge>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Direct P&amp;L margin improvement without risking strength
            </p>
          </div>
        </div>

        {/* ============================================================== */}
        {/* SCATTER CHART: CEMENT CONTENT VS. ACHIEVED STRENGTH */}
        {/* ============================================================== */}
        <div className="panel p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-foreground">
                Cementitious Content vs. 28-Day Cube Compressive Strength
              </h4>
              <p className="text-xs text-muted-foreground">
                X-Axis: Cement Content (kg/cum) · Y-Axis: 28-Day Strength (MPa). Tap any point for batch recipe breakdown.
              </p>
            </div>

            {/* Scatter Legend */}
            <div className="flex items-center gap-3 text-xs flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-indigo-500 shadow-xs" />
                <span className="text-foreground font-medium">Over-Strength / Potential Savings</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-emerald-500 shadow-xs" />
                <span className="text-muted-foreground">Optimal Mix</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-amber-500 shadow-xs" />
                <span className="text-muted-foreground">Standard Margin</span>
              </div>
            </div>
          </div>

          <div className="w-full pt-2">
            <ResponsiveContainer width="100%" height={360}>
              <ScatterChart margin={{ top: 20, right: 30, bottom: 25, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                <XAxis
                  type="number"
                  dataKey="cementContentKg"
                  name="Cement Content"
                  unit=" kg/cum"
                  domain={[280, 470]}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  stroke="#475569"
                />
                <YAxis
                  type="number"
                  dataKey="strength28d"
                  name="28d Strength"
                  unit=" MPa"
                  domain={[18, 56]}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  stroke="#475569"
                />
                <ZAxis type="number" dataKey="strength28d" range={[64, 64]} />

                {/* Reference Target Strength Line for selected grade */}
                {activeGradeStd && (
                  <ReferenceLine
                    y={activeGradeStd.targetStrength}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                  />
                )}
                {activeGradeStd && (
                  <ReferenceLine
                    y={activeGradeStd.fck}
                    stroke="#ef4444"
                    strokeDasharray="3 3"
                  />
                )}

                <Tooltip content={<CustomScatterTooltip />} />

                <Scatter
                  data={filteredBatches}
                  onClick={(e: any) => {
                    if (e && e.payload) setInspectBatch(e.payload);
                  }}
                  className="cursor-pointer"
                >
                  {filteredBatches.map((entry, index) => {
                    let fill = "#10b981"; // optimal
                    if (entry.status === "potential-saving") fill = "#6366f1"; // indigo
                    else if (entry.status === "standard") fill = "#f59e0b"; // amber
                    else if (entry.status === "understrength") fill = "#ef4444"; // rose
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={fill}
                        stroke="#ffffff"
                        strokeWidth={entry.status === "potential-saving" ? 2 : 1}
                      />
                    );
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ============================================================== */}
        {/* RANKED SAVINGS OPPORTUNITIES TABLE */}
        {/* ============================================================== */}
        <div className="panel p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-foreground">
                Top Mix Optimization Candidates (Flagged for QA Review)
              </h4>
              <p className="text-xs text-muted-foreground">
                Batches delivering surplus strength exceeding IS 456 target mean strength with highest cement reduction potential.
              </p>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              Showing {summary.savingsBatchesCount} batches
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3 text-left">Batch Sheet</th>
                  <th className="py-2.5 px-3 text-left">Grade</th>
                  <th className="py-2.5 px-3 text-left">Customer / Site</th>
                  <th className="py-2.5 px-3 text-right">Cement Content</th>
                  <th className="py-2.5 px-3 text-right">Target f_t</th>
                  <th className="py-2.5 px-3 text-right">28d Achieved</th>
                  <th className="py-2.5 px-3 text-right">Surplus Strength</th>
                  <th className="py-2.5 px-3 text-right">Suggested Cement Cut</th>
                  <th className="py-2.5 px-3 text-right">Projected Saving</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {batches
                  .filter((b) => b.status === "potential-saving")
                  .slice(0, 8)
                  .map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => setInspectBatch(b)}
                      className="hover:bg-surface-raised cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-primary">{b.id}</td>
                      <td className="py-2.5 px-3 font-semibold">{b.grade}</td>
                      <td className="py-2.5 px-3 max-w-[180px] truncate">
                        <span className="font-medium text-foreground">{b.customerName}</span>
                        <span className="block text-[10px] text-muted-foreground truncate">{b.siteName}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium">{b.cementContentKg} kg</td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{b.targetStrength} MPa</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {b.strength28d} MPa
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        +{b.overStrengthDelta} MPa
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        -{b.potentialCementSavingKg} kg/cum
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                        ₹{b.potentialRupeeSavingPerCum} / cum
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] text-primary hover:bg-primary/10"
                        >
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* BATCH MIX DETAIL MODAL (INSPECT BATCH) */}
      {/* ============================================================== */}
      {inspectBatch && (
        <Dialog open={!!inspectBatch} onOpenChange={(open) => !open && setInspectBatch(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary">
                  {inspectBatch.id}
                </Badge>
                <Badge
                  className={cn(
                    "text-[10px] font-bold",
                    inspectBatch.status === "potential-saving" && "bg-indigo-600 text-white",
                    inspectBatch.status === "optimal" && "bg-emerald-600 text-white",
                    inspectBatch.status === "standard" && "bg-amber-600 text-white"
                  )}
                >
                  {inspectBatch.status === "potential-saving" ? "Potential Cement Saving" : inspectBatch.status.toUpperCase()}
                </Badge>
              </div>
              <DialogTitle className="text-base sm:text-lg font-bold">
                Batch Mix Review &amp; Strength Analysis · {inspectBatch.grade}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Trip {inspectBatch.tripNumber} · Client: {inspectBatch.customerName} ({inspectBatch.siteName})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-xs mt-2">
              {/* Strength vs Target Comparison Card */}
              <div className="rounded-xl border border-border bg-surface-raised/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">Compressive Strength Profile:</span>
                  <span className="text-muted-foreground">IS 516 CTM Cube Test</span>
                </div>
                <div className="grid grid-cols-4 gap-2 pt-1 text-center">
                  <div className="p-2 rounded-lg bg-background border border-border">
                    <span className="text-[10px] text-muted-foreground block">Characteristic f_ck</span>
                    <strong className="text-sm font-mono font-bold">{inspectBatch.fck} MPa</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background border border-border">
                    <span className="text-[10px] text-muted-foreground block">Target Mean f_t</span>
                    <strong className="text-sm font-mono font-bold text-amber-500">{inspectBatch.targetStrength} MPa</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background border border-border">
                    <span className="text-[10px] text-muted-foreground block">7-Day Strength</span>
                    <strong className="text-sm font-mono font-bold text-foreground">{inspectBatch.strength7d} MPa</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-background border border-border">
                    <span className="text-[10px] text-muted-foreground block">28-Day Achieved</span>
                    <strong className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {inspectBatch.strength28d} MPa
                    </strong>
                  </div>
                </div>
              </div>

              {/* Mix Recipe Breakdown */}
              <div className="space-y-2">
                <span className="font-bold text-foreground block">Actual Batch Weights &amp; Parameters:</span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-lg border bg-background">
                    <span className="text-[10px] text-muted-foreground block">Cement Content</span>
                    <strong className="text-xs font-mono font-bold">{inspectBatch.cementContentKg} kg/cum</strong>
                  </div>
                  <div className="p-2.5 rounded-lg border bg-background">
                    <span className="text-[10px] text-muted-foreground block">Fly Ash Blend</span>
                    <strong className="text-xs font-mono font-bold">{inspectBatch.flyAshContentKg} kg/cum</strong>
                  </div>
                  <div className="p-2.5 rounded-lg border bg-background">
                    <span className="text-[10px] text-muted-foreground block">W/C Ratio</span>
                    <strong className="text-xs font-mono font-bold">{inspectBatch.waterCementRatio}</strong>
                  </div>
                </div>
              </div>

              {/* Optimization Recommendation Box */}
              {inspectBatch.status === "potential-saving" && (
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-700 dark:text-indigo-300">
                    <Sparkles className="size-4" />
                    <span>QA Optimization Recommendation:</span>
                  </div>
                  <p className="text-foreground leading-relaxed">
                    This batch achieved <strong>{inspectBatch.strength28d} MPa</strong>, which is <strong>+{inspectBatch.overStrengthDelta} MPa</strong> above the target mean requirement. A trial lab reduction of <strong>~{inspectBatch.potentialCementSavingKg} kg/cum</strong> cementitious material can yield <strong>₹{inspectBatch.potentialRupeeSavingPerCum} / cum</strong> cost reduction while remaining well above the IS 456 target threshold.
                  </p>
                </div>
              )}

              <div className="text-[11px] text-muted-foreground flex items-center justify-between border-t border-border pt-2">
                <span>Tested on: {inspectBatch.testedOn}</span>
                <span>QA Technologist: Meera Iyer</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function CustomScatterTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload as BatchMixRecord | undefined;
  if (!data || !data.id) return null;

  return (
    <div className="rounded-xl border border-border bg-popover p-3 shadow-xl text-xs space-y-1.5 max-w-xs z-50">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1">
        <span className="font-mono font-bold text-primary">{data.id}</span>
        <Badge
          variant="outline"
          className={cn(
            "text-[9px] font-bold px-1 py-0",
            data.status === "potential-saving" && "border-indigo-500/40 text-indigo-500 bg-indigo-500/10",
            data.status === "optimal" && "border-emerald-500/40 text-emerald-500 bg-emerald-500/10",
            data.status === "standard" && "border-amber-500/40 text-amber-500 bg-amber-500/10"
          )}
        >
          {data.grade}
        </Badge>
      </div>

      <div className="space-y-0.5 pt-0.5 text-muted-foreground">
        <p className="text-foreground font-semibold truncate">{data.customerName}</p>
        <div className="flex items-center justify-between">
          <span>Cement Content:</span>
          <strong className="text-foreground font-mono">{data.cementContentKg} kg/cum</strong>
        </div>
        <div className="flex items-center justify-between">
          <span>28d Strength Achieved:</span>
          <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">
            {data.strength28d} MPa
          </strong>
        </div>
        <div className="flex items-center justify-between">
          <span>Target Mean Strength:</span>
          <span className="font-mono">{data.targetStrength} MPa</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Surplus Strength:</span>
          <strong className="text-indigo-500 font-mono">+{data.overStrengthDelta} MPa</strong>
        </div>
      </div>

      {data.status === "potential-saving" && (
        <div className="mt-1 pt-1 border-t border-border/60 text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">
          <Sparkles className="size-3 shrink-0" />
          <span>Potential ~{data.potentialCementSavingKg} kg cement cut (₹{data.potentialRupeeSavingPerCum}/cum)</span>
        </div>
      )}

      <p className="text-[9px] text-muted-foreground/80 italic pt-1 text-center">
        Tap point to review batch recipe
      </p>
    </div>
  );
}
