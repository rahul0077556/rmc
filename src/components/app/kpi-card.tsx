import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

export interface KpiCardProps {
  label: string;
  value: string;
  change?: number;
  comparison?: string;
  icon: LucideIcon;
  spark?: { v: number }[];
  className?: string;
}

export function KpiCard({ label, value, change, comparison, icon: Icon, spark, className }: KpiCardProps) {
  const positive = (change ?? 0) >= 0;
  return (
    <div className={cn("panel group relative overflow-hidden p-4 transition-colors hover:border-primary/40", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
        </div>
        <span className="rounded-lg border border-border bg-surface-raised p-2 text-primary">
          <Icon className="size-4" />
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="text-xs">
          {change !== undefined && (
            <span className={cn("inline-flex items-center gap-0.5 font-medium", positive ? "text-success" : "text-destructive")}>
              {positive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {Math.abs(change)}%
            </span>
          )}
          {comparison && <span className="ml-1.5 text-muted-foreground">{comparison}</span>}
        </div>
        {spark && spark.length > 1 && (
          <div className="h-8 w-24 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
                <defs>
                  <linearGradient id={`spark-${label.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="var(--color-primary)"
                  strokeWidth={1.5}
                  fill={`url(#spark-${label.replace(/\s/g, "")})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
