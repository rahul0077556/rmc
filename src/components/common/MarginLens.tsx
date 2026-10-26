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
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Users,
  Clock,
  DollarSign,
  ArrowRight,
  ShieldAlert,
  Flame,
  CheckCircle2,
  FileText,
  Phone,
  Building2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getCustomerMarginProfiles,
  type CustomerMarginProfile,
} from "@/lib/margin-lens-data";
import { inr, cum } from "@/lib/format";
import { cn } from "@/lib/utils";

class SafeMarginErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: any) {
    console.error("CRASH IN MarginLens:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div id="crash-margin-box" className="p-6 bg-red-950 border border-red-500 rounded-xl text-red-200 m-4">
          <h2 className="text-base font-bold text-red-400">Crash in MarginLens</h2>
          <pre className="mt-2 text-xs font-mono whitespace-pre-wrap">{this.state.error.message}</pre>
          <pre className="mt-2 text-[10px] font-mono whitespace-pre-wrap opacity-75">{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export function MarginLens() {
  return (
    <SafeMarginErrorBoundary>
      <MarginLensContent />
    </SafeMarginErrorBoundary>
  );
}

function MarginLensContent() {
  const customers = useMemo(() => getCustomerMarginProfiles(), []);
  const [selectedFilter, setSelectedFilter] = useState<"ALL" | "SLOW_RISK" | "STARS" | "HIGH_VOL">("ALL");
  const [inspectCustomer, setInspectCustomer] = useState<CustomerMarginProfile | null>(null);

  const filtered = useMemo(() => {
    if (selectedFilter === "SLOW_RISK") return customers.filter((c) => c.delayStatus === "slow-risk");
    if (selectedFilter === "STARS") return customers.filter((c) => c.quadrant === "star");
    if (selectedFilter === "HIGH_VOL") return customers.filter((c) => c.totalVolumeCum >= 1800);
    return customers;
  }, [customers, selectedFilter]);

  const bigSlowCount = customers.filter((c) => c.delayStatus === "slow-risk").length;
  const totalOutstanding = customers.reduce((sum, c) => sum + c.totalOutstandingInr, 0);
  const totalVolume = customers.reduce((sum, c) => sum + c.totalVolumeCum, 0);
  const avgMargin = Math.round(customers.reduce((sum, c) => sum + c.netMarginPerCum, 0) / customers.length);

  return (
    <div className="rounded-xl border border-border bg-card shadow-md overflow-hidden space-y-0">
      {/* Header Bar */}
      <div className="border-b border-border bg-surface-raised/40 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-foreground">
                  Margin Lens (Customer Profitability &amp; Payment Delay)
                </h3>
                <Badge variant="outline" className="text-[11px] font-semibold border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                  Owner Commercial Intelligence
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bubble matrix mapping Net Margin (₹/cum) vs. Payment Delay (Days overdue). Bubble size represents total volume. Reveals at a glance who is big but slow to pay.
              </p>
            </div>
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant={selectedFilter === "ALL" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedFilter("ALL")}
              className="h-8 text-xs"
            >
              All Clients ({customers.length})
            </Button>
            <Button
              variant={selectedFilter === "SLOW_RISK" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedFilter("SLOW_RISK")}
              className={cn(
                "h-8 text-xs gap-1.5",
                selectedFilter === "SLOW_RISK" && "bg-rose-600 hover:bg-rose-700 text-white"
              )}
            >
              <AlertTriangle className="size-3.5 text-rose-400" />
              <span>Big &amp; Slow ({bigSlowCount})</span>
            </Button>
            <Button
              variant={selectedFilter === "STARS" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedFilter("STARS")}
              className={cn(
                "h-8 text-xs gap-1.5",
                selectedFilter === "STARS" && "bg-emerald-600 hover:bg-emerald-700 text-white"
              )}
            >
              <Sparkles className="size-3.5 text-emerald-300" />
              <span>Star Clients</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-6">
        {/* ============================================================== */}
        {/* KPI SUMMARY CARDS */}
        {/* ============================================================== */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="panel p-4">
            <span className="text-xs text-muted-foreground">Total Customer Volume</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold font-mono text-foreground">
                {cum(totalVolume)}
              </span>
              <span className="text-xs text-muted-foreground">8 Key Accounts</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Cumulative concrete supply</p>
          </div>

          <div className="panel p-4 border-emerald-500/20 bg-emerald-500/5">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              Average Net Margin
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                ₹{avgMargin} <span className="text-sm font-normal">/ cum</span>
              </span>
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                Seeded Rates
              </Badge>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Selling price minus recipe cost &amp; logistics
            </p>
          </div>

          <div className="panel p-4 border-rose-500/20 bg-rose-500/5">
            <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
              Slow-to-Pay Capital Drag
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
                {bigSlowCount} <span className="text-sm font-normal">Accounts</span>
              </span>
              <span className="text-xs font-bold text-rose-500 font-mono">
                &gt;40 Days Overdue
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Metro Infra, Shree Dev, Urban Infra
            </p>
          </div>

          <div className="panel p-4 border-amber-500/20 bg-amber-500/5">
            <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
              Total Market Receivables
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
                {inr(totalOutstanding)}
              </span>
              <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 dark:text-amber-400">
                Live Ledger
              </Badge>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              72% locked in slow-paying accounts
            </p>
          </div>
        </div>

        {/* ============================================================== */}
        {/* QUADRANT GUIDE CALLOUT */}
        {/* ============================================================== */}
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
            <span className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
              <Sparkles className="size-3.5" />
              🌟 Star Accounts (Top-Left)
            </span>
            <p className="mt-1 text-muted-foreground leading-relaxed">
              High Margin (&gt;₹1,180/cum) + Prompt Payer (&lt;15d delay). Prioritize mixers &amp; protect relationships.
            </p>
          </div>

          <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10">
            <span className="font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
              <AlertTriangle className="size-3.5" />
              ⚠️ Big &amp; Slow (Top-Right)
            </span>
            <p className="mt-1 text-muted-foreground leading-relaxed">
              High Volume + Severe Payment Delay (&gt;40d overdue). Huge profit on paper, but severe working capital drag.
            </p>
          </div>

          <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-500/10">
            <span className="font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
              <Building2 className="size-3.5" />
              📦 Cash Anchors (Bottom-Left)
            </span>
            <p className="mt-1 text-muted-foreground leading-relaxed">
              Moderate Margin + Fast Payment. Keeps plants running steadily and pays supplier dues reliably.
            </p>
          </div>

          <div className="p-3 rounded-xl border border-red-500/40 bg-red-500/15">
            <span className="font-bold text-red-700 dark:text-red-300 flex items-center gap-1.5">
              <ShieldAlert className="size-3.5" />
              🚨 Danger Zone (Bottom-Right)
            </span>
            <p className="mt-1 text-muted-foreground leading-relaxed">
              Low Margin + Long Delay. Unprofitable capital drag. Enforce rate hike or stop deliveries.
            </p>
          </div>
        </div>

        {/* ============================================================== */}
        {/* RECHARTS BUBBLE CHART */}
        {/* ============================================================== */}
        <div className="panel p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-foreground">
                Customer Profitability vs. Payment Delay Bubble Matrix
              </h4>
              <p className="text-xs text-muted-foreground">
                X-Axis: Payment Delay (Days overdue) · Y-Axis: Net Margin (₹/cum) · Bubble Size: Total Volume (cum). Tap any bubble for customer dossier.
              </p>
            </div>

            {/* Color Legend */}
            <div className="flex items-center gap-3 text-xs flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded-full bg-emerald-500 shadow-xs" />
                <span className="text-muted-foreground">Prompt (&lt;15d Delay)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded-full bg-amber-500 shadow-xs" />
                <span className="text-muted-foreground">Moderate (15-40d Delay)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded-full bg-rose-500 shadow-xs" />
                <span className="text-foreground font-semibold">Slow Risk (&gt;40d Delay)</span>
              </div>
            </div>
          </div>

          <div className="w-full pt-2">
            <ResponsiveContainer width="100%" height={380}>
              <ScatterChart margin={{ top: 20, right: 35, bottom: 25, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                <XAxis
                  type="number"
                  dataKey="paymentDelayDays"
                  name="Payment Delay"
                  unit=" days"
                  domain={[0, 65]}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  stroke="#475569"
                />
                <YAxis
                  type="number"
                  dataKey="netMarginPerCum"
                  name="Net Margin"
                  unit=" ₹/cum"
                  domain={[650, 1550]}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  stroke="#475569"
                />
                {/* Z-Axis maps volume (800 - 2850 cum) to bubble radius */}
                <ZAxis type="number" dataKey="totalVolumeCum" range={[200, 1100]} name="Volume" />

                {/* Reference line for 40-day critical delay threshold */}
                <ReferenceLine
                  x={40}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                />

                {/* Reference line for Average Margin */}
                <ReferenceLine
                  y={1150}
                  stroke="#94a3b8"
                  strokeDasharray="3 3"
                />

                <Tooltip content={<CustomBubbleTooltip />} />

                <Scatter
                  data={filtered}
                  onClick={(e: any) => {
                    if (e && e.payload) setInspectCustomer(e.payload);
                  }}
                  className="cursor-pointer"
                >
                  {filtered.map((entry, index) => {
                    let fill = "#10b981"; // prompt
                    if (entry.delayStatus === "moderate") fill = "#f59e0b";
                    else if (entry.delayStatus === "slow-risk") fill = "#ef4444";
                    return (
                      <Cell
                        key={`bubble-${index}`}
                        fill={fill}
                        fillOpacity={0.8}
                        stroke="#ffffff"
                        strokeWidth={entry.delayStatus === "slow-risk" ? 2.5 : 1.5}
                      />
                    );
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ============================================================== */}
        {/* RANKED COMMERCIAL POSITION TABLE */}
        {/* ============================================================== */}
        <div className="panel p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-foreground">
                Customer Commercial Ledger &amp; Credit Risk Ranking
              </h4>
              <p className="text-xs text-muted-foreground">
                Ranked by Working Capital Delay Drag (Volume × Overdue Days). Identifies clients requiring credit limits adjustments.
              </p>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {customers.length} accounts evaluated
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3 text-left">Customer</th>
                  <th className="py-2.5 px-3 text-right">Delivered Vol</th>
                  <th className="py-2.5 px-3 text-right">Avg Selling Rate</th>
                  <th className="py-2.5 px-3 text-right">Material Cost</th>
                  <th className="py-2.5 px-3 text-right">Net Margin</th>
                  <th className="py-2.5 px-3 text-right">Credit Terms</th>
                  <th className="py-2.5 px-3 text-right">Payment Delay</th>
                  <th className="py-2.5 px-3 text-right">Total Outstanding</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {customers
                  .sort((a, b) => (b.paymentDelayDays * b.totalVolumeCum) - (a.paymentDelayDays * a.totalVolumeCum))
                  .map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setInspectCustomer(c)}
                      className="hover:bg-surface-raised cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-foreground block">{c.name}</span>
                        <span className="text-[10px] text-muted-foreground">{c.contactPerson}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium">{cum(c.totalVolumeCum)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">₹{c.avgSellingPricePerCum}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">₹{c.materialCostPerCum}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{c.netMarginPerCum} / cum
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{c.creditDays}d</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        <span
                          className={cn(
                            c.delayStatus === "slow-risk" && "text-rose-600 dark:text-rose-400 font-extrabold",
                            c.delayStatus === "moderate" && "text-amber-600 dark:text-amber-400",
                            c.delayStatus === "prompt" && "text-emerald-600 dark:text-emerald-400"
                          )}
                        >
                          +{c.paymentDelayDays} days
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                        {inr(c.totalOutstandingInr)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] font-bold px-1.5 py-0.2",
                            c.delayStatus === "slow-risk" && "border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/10",
                            c.delayStatus === "moderate" && "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10",
                            c.delayStatus === "prompt" && "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                          )}
                        >
                          {c.delayStatus === "slow-risk" ? "BIG & SLOW" : c.delayStatus === "prompt" ? "PROMPT" : "MODERATE"}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] text-primary hover:bg-primary/10"
                        >
                          Dossier
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
      {/* CUSTOMER COMMERCIAL DOSSIER MODAL */}
      {/* ============================================================== */}
      {inspectCustomer && (
        <Dialog open={!!inspectCustomer} onOpenChange={(open) => !open && setInspectCustomer(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary">
                  {inspectCustomer.id}
                </Badge>
                <Badge
                  className={cn(
                    "text-[10px] font-bold",
                    inspectCustomer.delayStatus === "slow-risk" && "bg-rose-600 text-white",
                    inspectCustomer.delayStatus === "moderate" && "bg-amber-600 text-white",
                    inspectCustomer.delayStatus === "prompt" && "bg-emerald-600 text-white"
                  )}
                >
                  {inspectCustomer.delayStatus === "slow-risk" ? "CRITICAL DELAY RISK" : inspectCustomer.delayStatus.toUpperCase()}
                </Badge>
              </div>
              <DialogTitle className="text-base sm:text-lg font-bold">
                {inspectCustomer.name} · Commercial &amp; Credit Dossier
              </DialogTitle>
              <DialogDescription className="text-xs">
                Contact: {inspectCustomer.contactPerson} ({inspectCustomer.phone})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-xs mt-2">
              {/* Financial Summary 4-Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-2.5 rounded-lg border bg-surface-raised/40">
                  <span className="text-[10px] text-muted-foreground block">Total Volume</span>
                  <strong className="text-sm font-mono font-bold text-foreground">
                    {cum(inspectCustomer.totalVolumeCum)}
                  </strong>
                </div>
                <div className="p-2.5 rounded-lg border bg-surface-raised/40">
                  <span className="text-[10px] text-muted-foreground block">Net Margin</span>
                  <strong className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    ₹{inspectCustomer.netMarginPerCum} / cum
                  </strong>
                </div>
                <div className="p-2.5 rounded-lg border bg-surface-raised/40">
                  <span className="text-[10px] text-muted-foreground block">Payment Delay</span>
                  <strong className={cn(
                    "text-sm font-mono font-bold",
                    inspectCustomer.delayStatus === "slow-risk" ? "text-rose-600 dark:text-rose-400" : "text-foreground"
                  )}>
                    +{inspectCustomer.paymentDelayDays} days
                  </strong>
                </div>
                <div className="p-2.5 rounded-lg border bg-surface-raised/40">
                  <span className="text-[10px] text-muted-foreground block">Total Outstanding</span>
                  <strong className="text-sm font-mono font-bold text-foreground">
                    {inr(inspectCustomer.totalOutstandingInr)}
                  </strong>
                </div>
              </div>

              {/* Margin & Material Cost Breakdown */}
              <div className="rounded-xl border border-border p-3.5 space-y-2 bg-background">
                <span className="font-bold text-foreground block">Seeded Recipe Cost Economics:</span>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Average Invoiced Selling Rate:</span>
                    <strong className="font-mono text-foreground">₹{inspectCustomer.avgSellingPricePerCum} / cum</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Seeded Raw Materials (Cement, Fly Ash, Sand, Aggregates, Admix):</span>
                    <span className="font-mono text-rose-500">-₹{inspectCustomer.materialCostPerCum} / cum</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Logistics &amp; Delivery (Transit Diesel &amp; Driver Incentive):</span>
                    <span className="font-mono text-rose-500">-₹{inspectCustomer.logisticsCostPerCum} / cum</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-border font-bold">
                    <span className="text-foreground">Net Plant Margin Contribution:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      +₹{inspectCustomer.netMarginPerCum} / cum (Total: {inr(inspectCustomer.totalNetProfitInr)})
                    </span>
                  </div>
                </div>
              </div>

              {/* Plant Diagnosis & Action Box */}
              <div
                className={cn(
                  "rounded-xl border p-3.5 space-y-1.5",
                  inspectCustomer.delayStatus === "slow-risk" ? "border-rose-500/30 bg-rose-500/10 text-rose-950 dark:text-rose-100" : "border-primary/20 bg-primary/5 text-foreground"
                )}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  {inspectCustomer.delayStatus === "slow-risk" ? (
                    <AlertTriangle className="size-4 text-rose-500" />
                  ) : (
                    <CheckCircle2 className="size-4 text-primary" />
                  )}
                  <span>Owner Diagnosis:</span>
                </div>
                <p className="leading-relaxed font-medium">
                  {inspectCustomer.insightNote}
                </p>
                <div className="pt-1 text-[11px] text-muted-foreground">
                  <strong>Recommended Owner Action:</strong> {inspectCustomer.recommendedAction}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function CustomBubbleTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload as CustomerMarginProfile | undefined;
  if (!data || !data.name) return null;

  return (
    <div className="rounded-xl border border-border bg-popover p-3.5 shadow-xl text-xs space-y-2 max-w-xs z-50">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5">
        <span className="font-bold text-foreground truncate">{data.name}</span>
        <Badge
          variant="outline"
          className={cn(
            "text-[9px] font-bold px-1.5 py-0.2",
            data.delayStatus === "slow-risk" && "border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/10",
            data.delayStatus === "moderate" && "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10",
            data.delayStatus === "prompt" && "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
          )}
        >
          {data.delayStatus === "slow-risk" ? "BIG & SLOW" : data.delayStatus.toUpperCase()}
        </Badge>
      </div>

      <div className="space-y-1 text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>Delivered Volume:</span>
          <strong className="text-foreground font-mono font-bold">{cum(data.totalVolumeCum)}</strong>
        </div>
        <div className="flex items-center justify-between">
          <span>Net Margin:</span>
          <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">
            ₹{data.netMarginPerCum} / cum
          </strong>
        </div>
        <div className="flex items-center justify-between">
          <span>Agreed Credit:</span>
          <span className="font-mono">{data.creditDays} days</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Actual Avg Pay Time:</span>
          <span className="font-mono">{data.actualAvgPayDays} days</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Payment Delay:</span>
          <strong
            className={cn(
              "font-mono font-bold",
              data.delayStatus === "slow-risk" ? "text-rose-600 dark:text-rose-400" : "text-foreground"
            )}
          >
            +{data.paymentDelayDays} days overdue
          </strong>
        </div>
        <div className="flex items-center justify-between border-t border-border/60 pt-1">
          <span>Total Outstanding:</span>
          <strong className="text-foreground font-mono">{inr(data.totalOutstandingInr)}</strong>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/90 italic pt-1 border-t border-border/60">
        Tap bubble to open full commercial dossier
      </p>
    </div>
  );
}
