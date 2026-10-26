import { useState } from "react";
import {
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Trash2,
  Scale,
  Droplets,
  Truck,
  ArrowRight,
  Info,
  Calendar,
  Layers,
  ChevronRight,
  IndianRupee,
  Factory,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface BranchDetail {
  id: string;
  name: string;
  volumeCum: number;
  weightMt: number;
  rupeeValue: number;
  percentage: number;
  color: string;
  badgeVariant: "destructive" | "warning" | "success" | "outline";
  items: {
    reference: string;
    description: string;
    quantity: string;
    lossRs: number;
    reason: string;
  }[];
}

const FLOW_DATA: Record<"today" | "week" | "month", {
  inwardMt: number;
  inwardCostRs: number;
  batchedCum: number;
  batchedMt: number;
  delivered: BranchDetail;
  rejected: BranchDetail;
  washout: BranchDetail;
  variance: BranchDetail;
}> = {
  today: {
    inwardMt: 2211.3,
    inwardCostRs: 4207750,
    batchedCum: 910,
    batchedMt: 2184,
    delivered: {
      id: "delivered",
      name: "Delivered & Invoiced",
      volumeCum: 872,
      weightMt: 2092.8,
      rupeeValue: 4428000,
      percentage: 95.82,
      color: "#10b981",
      badgeVariant: "success",
      items: [
        { reference: "PO-2026-0001", description: "Wagh Infra · Metro Line 3 Pier P14", quantity: "120 cum (M35)", lossRs: 0, reason: "15 TMs completed on schedule" },
        { reference: "PO-2026-0002", description: "Kirloskar Infra · Hinjewadi IT Park", quantity: "32 cum (M35)", lossRs: 0, reason: "4 TMs poured directly to boom pump" },
        { reference: "PO-2026-0003", description: "VTP Realty · Pegasus Tower Raft", quantity: "80 cum (M25)", lossRs: 0, reason: "10 TMs night shift pour" },
      ],
    },
    rejected: {
      id: "rejected",
      name: "Rejected Concrete",
      volumeCum: 16,
      weightMt: 38.4,
      rupeeValue: 84800,
      percentage: 1.76,
      color: "#ef4444",
      badgeVariant: "destructive",
      items: [
        { reference: "TRIP-2026-0002", description: "TM MH-12-RN-1002 · Driver Ritesh Shinde", quantity: "8 cum (M35)", lossRs: 45200, reason: "Concrete Clock expired on Kharadi bypass (>130 min transit slump loss)" },
        { reference: "TRIP-2026-0019", description: "TM MH-12-RN-1008 · Driver Suresh More", quantity: "8 cum (M25)", lossRs: 39600, reason: "Client site static pump breakdown at Pier P12; initial set began in drum" },
      ],
    },
    washout: {
      id: "washout",
      name: "Drum Washout & Slurry",
      volumeCum: 14,
      weightMt: 33.6,
      rupeeValue: 50600,
      percentage: 1.54,
      color: "#f59e0b",
      badgeVariant: "warning",
      items: [
        { reference: "RECLAIM-01", description: "Plant 1 Reclaimer Pit (CRB-75 wash)", quantity: "7.5 cum equiv", lossRs: 28400, reason: "Residual blade concrete washed out after 48 trips. Reclaimed 12 MT aggregate" },
        { reference: "RECLAIM-02", description: "Plant 2 Reclaimer Pit (SP-30 wash)", quantity: "6.5 cum equiv", lossRs: 22200, reason: "Drum rinse post M40 high-strength mixes" },
      ],
    },
    variance: {
      id: "variance",
      name: "Yield & Scale Variance",
      volumeCum: 8,
      weightMt: 19.2,
      rupeeValue: 38200,
      percentage: 0.88,
      color: "#818cf8",
      badgeVariant: "outline",
      items: [
        { reference: "VAR-SCALE", description: "Batcher Load Cell vs WB Inward Gross", quantity: "11.4 MT sand", lossRs: 22800, reason: "Stockpile surface moisture evaporation during afternoon peak (36°C ambient)" },
        { reference: "VAR-SILO", description: "Silo Bin 2 OPC 53 Cement Aeration", quantity: "7.8 MT cement", lossRs: 15400, reason: "Pneumatic filter back-pressure dust collection variance (within ±1.0% limit)" },
      ],
    },
  },
  week: {
    inwardMt: 14820.5,
    inwardCostRs: 28150000,
    batchedCum: 6150,
    batchedMt: 14760,
    delivered: {
      id: "delivered",
      name: "Delivered & Invoiced",
      volumeCum: 5910,
      weightMt: 14184,
      rupeeValue: 30141000,
      percentage: 96.1,
      color: "#10b981",
      badgeVariant: "success",
      items: [
        { reference: "WEEK-DEL-01", description: "Pune Metro Line 3 package pours", quantity: "2,420 cum", lossRs: 0, reason: "Continuous day/night pours" },
        { reference: "WEEK-DEL-02", description: "Commercial IT parks & residential rafts", quantity: "3,490 cum", lossRs: 0, reason: "Standard mix designs M25-M40" },
      ],
    },
    rejected: {
      id: "rejected",
      name: "Rejected Concrete",
      volumeCum: 96,
      weightMt: 230.4,
      rupeeValue: 508800,
      percentage: 1.56,
      color: "#ef4444",
      badgeVariant: "destructive",
      items: [
        { reference: "WEEK-REJ-01", description: "Traffic gridlock transit delays (4 trips)", quantity: "32 cum", lossRs: 172000, reason: "Concrete Clock slump retention expired" },
        { reference: "WEEK-REJ-02", description: "Site pump clogs & sudden rain on unpoured slab", quantity: "64 cum", lossRs: 336800, reason: "Customer requested diversion to precast yard" },
      ],
    },
    washout: {
      id: "washout",
      name: "Drum Washout & Slurry",
      volumeCum: 88,
      weightMt: 211.2,
      rupeeValue: 318000,
      percentage: 1.43,
      color: "#f59e0b",
      badgeVariant: "warning",
      items: [
        { reference: "WEEK-WASH-01", description: "Transit mixer drum cleaning & slurry pit", quantity: "88 cum equiv", lossRs: 318000, reason: "720 washouts performed; 140 MT gravel recovered" },
      ],
    },
    variance: {
      id: "variance",
      name: "Yield & Scale Variance",
      volumeCum: 56,
      weightMt: 134.4,
      rupeeValue: 268000,
      percentage: 0.91,
      color: "#818cf8",
      badgeVariant: "outline",
      items: [
        { reference: "WEEK-VAR-01", description: "Aggregate moisture loss & scale drift", quantity: "134.4 MT", lossRs: 268000, reason: "Mass balance discrepancy within ±1.5% calibration" },
      ],
    },
  },
  month: {
    inwardMt: 64200.0,
    inwardCostRs: 121980000,
    batchedCum: 26500,
    batchedMt: 63600,
    delivered: {
      id: "delivered",
      name: "Delivered & Invoiced",
      volumeCum: 25480,
      weightMt: 61152,
      rupeeValue: 129948000,
      percentage: 96.15,
      color: "#10b981",
      badgeVariant: "success",
      items: [
        { reference: "MONTH-DEL-01", description: "Total Monthly Production delivered", quantity: "25,480 cum", lossRs: 0, reason: "3,185 dispatches executed" },
      ],
    },
    rejected: {
      id: "rejected",
      name: "Rejected Concrete",
      volumeCum: 412,
      weightMt: 988.8,
      rupeeValue: 2183600,
      percentage: 1.55,
      color: "#ef4444",
      badgeVariant: "destructive",
      items: [
        { reference: "MONTH-REJ-01", description: "Monthly Slump & Setting Failures", quantity: "412 cum", lossRs: 2183600, reason: "Cold joint risks, site access blocks, heavy rains" },
      ],
    },
    washout: {
      id: "washout",
      name: "Drum Washout & Slurry",
      volumeCum: 375,
      weightMt: 900.0,
      rupeeValue: 1350000,
      percentage: 1.42,
      color: "#f59e0b",
      badgeVariant: "warning",
      items: [
        { reference: "MONTH-WASH-01", description: "Plant Slurry Pit recycling", quantity: "375 cum", lossRs: 1350000, reason: "Aggregate reclamation recovered ₹4.8 Lakhs value" },
      ],
    },
    variance: {
      id: "variance",
      name: "Yield & Scale Variance",
      volumeCum: 233,
      weightMt: 559.2,
      rupeeValue: 1118400,
      percentage: 0.88,
      color: "#818cf8",
      badgeVariant: "outline",
      items: [
        { reference: "MONTH-VAR-01", description: "Weighbridge vs Load-cell reconciliation", quantity: "559 MT", lossRs: 1118400, reason: "Yield factor 0.9912 (Target: 0.9900)" },
      ],
    },
  },
};

export function MaterialFlowDiagram({ className }: { className?: string }) {
  const [timeframe, setTimeframe] = useState<"today" | "week" | "month">("today");
  const [selectedBranch, setSelectedBranch] = useState<BranchDetail | null>(null);

  const data = FLOW_DATA[timeframe];
  const totalWasteLoss = data.rejected.rupeeValue + data.washout.rupeeValue + data.variance.rupeeValue;

  return (
    <Card className={cn("border border-border/80 shadow-sm overflow-hidden", className)}>
      <CardHeader className="border-b border-border/60 bg-gradient-to-r from-card via-card to-primary/5 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Factory className="size-4" />
              </span>
              <CardTitle className="text-base font-bold tracking-tight">
                Material Flow & Waste Reconciliation (Mass Balance)
              </CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">
              End-to-end audit tracking: Weighbridge inward materials ➔ Plant batching ➔ Delivered concrete vs. Rupee value of waste.
            </p>
          </div>

          {/* Timeframe Switcher */}
          <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-xl border border-border/60 shrink-0">
            {(["today", "week", "month"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTimeframe(t)}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer",
                  timeframe === t
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "today" ? "Today's Shift" : t === "week" ? "This Week" : "Month-to-Date"}
              </button>
            ))}
          </div>
        </div>

        {/* Executive Metrics Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
          <div className="rounded-xl border border-border/60 bg-surface-raised/70 p-3">
            <span className="text-[11px] font-medium text-muted-foreground block">Inward Raw Materials:</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-bold text-foreground tabular-nums">
                {data.inwardMt.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground font-semibold">MT</span>
            </div>
            <span className="text-[10px] text-muted-foreground/80 mt-0.5 block">
              ₹{(data.inwardCostRs / 100000).toFixed(2)} Lakhs at WB
            </span>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <span className="text-[11px] font-medium text-emerald-400 block">Delivered Concrete:</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-bold text-emerald-400 tabular-nums">
                {data.delivered.volumeCum.toLocaleString()}
              </span>
              <span className="text-xs text-emerald-400 font-semibold">cum</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-semibold mt-0.5 block">
              {data.delivered.percentage}% Delivered Yield
            </span>
          </div>

          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
            <span className="text-[11px] font-medium text-rose-400 block">Total Cost of Waste:</span>
            <div className="flex items-baseline gap-1 mt-1 text-rose-500">
              <span className="text-lg font-bold tabular-nums">
                ₹{totalWasteLoss.toLocaleString()}
              </span>
            </div>
            <span className="text-[10px] text-rose-400/90 font-semibold mt-0.5 block">
              Rejections + Washout + Variance
            </span>
          </div>

          <div className="rounded-xl border border-border/60 bg-surface-raised/70 p-3">
            <span className="text-[11px] font-medium text-muted-foreground block">Scale Calibration Variance:</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-bold text-foreground tabular-nums">
                ±{data.variance.percentage}%
              </span>
            </div>
            <span className="text-[10px] text-emerald-400 font-semibold mt-0.5 block">
              ✓ Within IS 4926 (±1.5%)
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-6">
        {/* Flow Chart Canvas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Node 1: Inward Materials */}
          <div className="lg:col-span-3 rounded-2xl border border-border/80 bg-card p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-[10px] uppercase font-bold bg-muted/40">
                Stage 1: Inflow
              </Badge>
              <Scale className="size-4 text-primary" />
            </div>

            <div>
              <h4 className="text-sm font-bold text-foreground">Inward Raw Materials</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Weighbridge Gross - Tare receipts
              </p>
            </div>

            <div className="space-y-1.5 pt-1 text-xs">
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Cement & Fly Ash:</span>
                <span className="font-semibold tabular-nums">{(data.inwardMt * 0.16).toFixed(1)} MT</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Aggregates (10 & 20mm):</span>
                <span className="font-semibold tabular-nums">{(data.inwardMt * 0.53).toFixed(1)} MT</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Manufactured Sand:</span>
                <span className="font-semibold tabular-nums">{(data.inwardMt * 0.31).toFixed(1)} MT</span>
              </div>
              <div className="flex justify-between py-1 pt-1.5 font-bold">
                <span>Total Received:</span>
                <span className="text-primary tabular-nums">{data.inwardMt.toLocaleString()} MT</span>
              </div>
            </div>
          </div>

          {/* Flow Connector Arrow */}
          <div className="hidden lg:flex lg:col-span-1 items-center justify-center">
            <div className="w-full flex items-center justify-center relative">
              <div className="h-0.5 w-full bg-gradient-to-r from-primary to-cyan-500" />
              <ArrowRight className="size-4 text-cyan-400 absolute right-0" />
            </div>
          </div>

          {/* Node 2: Plant Batching & Mixing */}
          <div className="lg:col-span-3 rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-card to-cyan-950/10 p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-[10px] uppercase font-bold border-cyan-500/40 text-cyan-400 bg-cyan-500/10">
                Stage 2: Batching
              </Badge>
              <Factory className="size-4 text-cyan-400" />
            </div>

            <div>
              <h4 className="text-sm font-bold text-foreground">Plant CRB-75 & SP-30</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Automated SCADA Mixer load cells
              </p>
            </div>

            <div className="rounded-xl bg-surface-raised/70 p-2.5 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Total Batched:</span>
                <span className="font-bold text-cyan-400 tabular-nums">{data.batchedCum.toLocaleString()} cum</span>
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Mass Equivalent:</span>
                <span className="tabular-nums">{data.batchedMt.toLocaleString()} MT</span>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
              Charged into transit mixer drums with automated moisture probe compensation.
            </p>
          </div>

          {/* Flow Connector Arrow */}
          <div className="hidden lg:flex lg:col-span-1 items-center justify-center">
            <div className="w-full flex items-center justify-center relative">
              <div className="h-0.5 w-full bg-gradient-to-r from-cyan-500 to-indigo-500" />
              <ArrowRight className="size-4 text-indigo-400 absolute right-0" />
            </div>
          </div>

          {/* Node 3: 4 Output Branches (Delivered vs Waste Branches) */}
          <div className="lg:col-span-4 space-y-2.5">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Stage 3: Output Branches & Waste:
              </span>
              <span className="text-[11px] text-muted-foreground">Tap card for details</span>
            </div>

            {/* Branch A: Delivered & Invoiced */}
            <div
              onClick={() => setSelectedBranch(data.delivered)}
              className="group rounded-xl border border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/60 p-3 transition-all cursor-pointer shadow-xs hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-bold text-foreground">{data.delivered.name}</span>
                </div>
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[10px] font-bold">
                  {data.delivered.percentage}% Yield
                </Badge>
              </div>

              <div className="flex items-baseline justify-between mt-2 text-xs">
                <span className="font-bold text-emerald-400 tabular-nums">
                  {data.delivered.volumeCum.toLocaleString()} cum ({data.delivered.weightMt.toFixed(1)} MT)
                </span>
                <span className="text-[11px] font-semibold text-emerald-400">
                  ₹{(data.delivered.rupeeValue / 100000).toFixed(2)}L Revenue
                </span>
              </div>
            </div>

            {/* Branch B: Rejected Concrete */}
            <div
              onClick={() => setSelectedBranch(data.rejected)}
              className="group rounded-xl border border-rose-500/30 bg-rose-500/5 hover:border-rose-500/60 p-3 transition-all cursor-pointer shadow-xs hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-xs font-bold text-foreground">{data.rejected.name}</span>
                </div>
                <Badge variant="destructive" className="text-[10px] font-bold bg-rose-600 text-white">
                  -₹{data.rejected.rupeeValue.toLocaleString()} Waste
                </Badge>
              </div>

              <div className="flex items-baseline justify-between mt-2 text-xs">
                <span className="font-semibold text-rose-400 tabular-nums">
                  {data.rejected.volumeCum} cum ({data.rejected.weightMt} MT)
                </span>
                <span className="text-[11px] text-rose-400 font-semibold">
                  {data.rejected.percentage}% of production
                </span>
              </div>
            </div>

            {/* Branch C: Drum Washout & Slurry */}
            <div
              onClick={() => setSelectedBranch(data.washout)}
              className="group rounded-xl border border-amber-500/30 bg-amber-500/5 hover:border-amber-500/60 p-3 transition-all cursor-pointer shadow-xs hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-amber-400" />
                  <span className="text-xs font-bold text-foreground">{data.washout.name}</span>
                </div>
                <Badge variant="outline" className="border-amber-500/40 text-amber-400 text-[10px] font-bold">
                  -₹{data.washout.rupeeValue.toLocaleString()} Loss
                </Badge>
              </div>

              <div className="flex items-baseline justify-between mt-2 text-xs">
                <span className="font-semibold text-amber-400 tabular-nums">
                  {data.washout.volumeCum} cum ({data.washout.weightMt} MT)
                </span>
                <span className="text-[11px] text-amber-400 font-semibold">
                  {data.washout.percentage}% drum residual
                </span>
              </div>
            </div>

            {/* Branch D: Yield & Scale Variance */}
            <div
              onClick={() => setSelectedBranch(data.variance)}
              className="group rounded-xl border border-indigo-500/30 bg-indigo-500/5 hover:border-indigo-500/60 p-3 transition-all cursor-pointer shadow-xs hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-indigo-400" />
                  <span className="text-xs font-bold text-foreground">{data.variance.name}</span>
                </div>
                <Badge variant="outline" className="border-indigo-500/40 text-indigo-400 text-[10px] font-bold">
                  ±₹{data.variance.rupeeValue.toLocaleString()} Variance
                </Badge>
              </div>

              <div className="flex items-baseline justify-between mt-2 text-xs">
                <span className="font-semibold text-indigo-400 tabular-nums">
                  {data.variance.volumeCum} cum equiv ({data.variance.weightMt} MT)
                </span>
                <span className="text-[11px] text-indigo-400 font-semibold">
                  {data.variance.percentage}% scale tolerance
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Drill-down Inspection Dialog */}
      <Dialog open={!!selectedBranch} onOpenChange={() => setSelectedBranch(null)}>
        <DialogContent className="max-w-xl">
          {selectedBranch && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    <span className="size-3 rounded-full" style={{ backgroundColor: selectedBranch.color }} />
                    {selectedBranch.name} Breakdown
                  </DialogTitle>
                  <Badge variant={selectedBranch.badgeVariant} className="text-xs font-bold">
                    {selectedBranch.id === "delivered" ? "+" : "-"}₹{selectedBranch.rupeeValue.toLocaleString()}
                  </Badge>
                </div>
                <DialogDescription className="text-xs">
                  {selectedBranch.id === "delivered"
                    ? "Invoiced concrete volume verified with signed e-Challan customer receipts."
                    : `Financial and operational waste breakdown resulting in ₹${selectedBranch.rupeeValue.toLocaleString()} total loss.`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-surface-raised border border-border/60 text-center">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Volume</span>
                    <p className="text-sm font-bold text-foreground tabular-nums mt-0.5">
                      {selectedBranch.volumeCum} cum
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Mass</span>
                    <p className="text-sm font-bold text-foreground tabular-nums mt-0.5">
                      {selectedBranch.weightMt} MT
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Share of Batch</span>
                    <p className="text-sm font-bold text-foreground tabular-nums mt-0.5">
                      {selectedBranch.percentage}%
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Contributing Batches / Incidents:
                  </h5>
                  <div className="divide-y divide-border/60 rounded-xl border border-border/70 overflow-hidden bg-card/60">
                    {selectedBranch.items.map((it) => (
                      <div key={it.reference} className="p-3 space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-primary font-mono">{it.reference}</span>
                          <span className="font-bold text-foreground tabular-nums">
                            {it.lossRs > 0 ? `₹${it.lossRs.toLocaleString()} Loss` : it.quantity}
                          </span>
                        </div>
                        <p className="text-xs text-foreground font-medium">{it.description}</p>
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          Reason: {it.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
