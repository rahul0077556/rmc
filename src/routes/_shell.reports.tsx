import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ChartCard } from "@/components/app/chart-card";
import { LoadingState, ErrorState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { REPORTS, reportsApi, toCsv } from "@/api/reports";

export const Route = createFileRoute("/_shell/reports")({
  head: () => ({
    meta: [
      { title: "Reports · RMC Command Center" },
      { name: "description", content: "Production, quality, material and commercial reports with CSV export." },
      { property: "og:title", content: "Reports · RMC Command Center" },
      { property: "og:description", content: "Production, quality, material and commercial reports with CSV export." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const [active, setActive] = useState<string | null>(null);
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const result = useQuery({
    queryKey: ["report", active, from, to],
    queryFn: () => reportsApi.run(active!, from, to).then((r) => r.data),
    enabled: active !== null,
  });

  const definition = REPORTS.find((r) => r.id === active);

  function exportCsv() {
    if (!result.data || !definition) return;
    const blob = new Blob([toCsv(result.data)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${definition.id}-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reports Center" subtitle="Production, quality, material and commercial reporting" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((report) => (
          <button
            key={report.id}
            onClick={() => setActive(report.id)}
            className={`panel p-4 text-left transition-colors hover:border-primary/50 ${
              active === report.id ? "border-primary/60" : ""
            }`}
          >
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{report.group}</p>
            <p className="mt-1.5 text-sm font-medium">{report.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{report.description}</p>
          </button>
        ))}
      </div>

      {definition && (
        <ChartCard
          title={definition.title}
          description={definition.description}
          actions={
            <>
              <Button size="sm" variant="outline" onClick={exportCsv} disabled={!result.data}>
                <Download className="size-3.5" /> Export CSV
              </Button>
              <Button size="sm" variant="outline" onClick={() => window.print()}>
                <Printer className="size-3.5" /> Print
              </Button>
            </>
          }
        >
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </div>
          </div>

          {result.isLoading && <LoadingState rows={3} />}
          {result.error && <ErrorState message="This report could not be generated." onRetry={() => void result.refetch()} />}
          {result.data && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                    {result.data.columns.map((c) => (
                      <th key={c} className="border-b border-border px-3 py-2 text-left">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.data.rows.map((row, i) => (
                    <tr key={i} className="border-b border-border/60 last:border-0">
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-2">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.data.rows.length === 0 && (
                <p className="py-10 text-center text-xs text-muted-foreground">No records in this date range.</p>
              )}
            </div>
          )}
        </ChartCard>
      )}
    </div>
  );
}
