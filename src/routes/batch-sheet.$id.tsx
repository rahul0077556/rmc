import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/app/states";
import { StatusBadge } from "@/components/app/status-badge";
import { productionApi } from "@/api/production";
import { PLANT_NAME } from "@/lib/mock-data";
import { cum, dt, num } from "@/lib/format";

export const Route = createFileRoute("/batch-sheet/$id")({
  head: () => ({
    meta: [
      { title: "Batch Sheet · RMC Command Center" },
      { name: "description", content: "Printable batch sheet with theoretical and actual material consumption." },
      { property: "og:title", content: "Batch Sheet · RMC Command Center" },
      { property: "og:description", content: "Printable batch sheet with theoretical and actual material consumption." },
    ],
  }),
  component: BatchSheetPage,
});

function BatchSheetPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const sheet = useQuery({ queryKey: ["batch-sheet", id], queryFn: () => productionApi.batchSheet(id).then((r) => r.data) });

  if (sheet.isLoading) return <div className="p-6"><LoadingState rows={4} /></div>;
  if (sheet.error || !sheet.data) return <div className="p-6"><ErrorState message="This batch sheet could not be found." /></div>;

  const s = sheet.data;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="no-print flex items-center justify-between">
          <Button variant="ghost" onClick={() => void navigate({ to: "/production" })}>
            <ArrowLeft className="size-4" /> Back
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="size-4" /> Print batch sheet
          </Button>
        </div>

        <article className="panel space-y-5 p-6 print:border-0 print:shadow-none">
          <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
            <div>
              <p className="text-lg font-semibold">RMC Command Center</p>
              <p className="text-xs text-muted-foreground">{PLANT_NAME}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Batch Sheet</p>
              <p className="text-base font-semibold">{s.batchNumber}</p>
            </div>
          </header>

          <section className="grid gap-3 text-sm sm:grid-cols-2">
            {[
              ["Trip", s.trip.tripNumber],
              ["Purchase Order", s.trip.poNumber],
              ["Customer", s.trip.customerName],
              ["Site", s.trip.siteName],
              ["Grade", s.trip.grade],
              ["Quantity", cum(s.trip.quantity)],
              ["Transit Mixer", s.trip.tmCode],
              ["Driver", s.trip.driverName],
              ["Batch Time", dt(s.batchTime)],
              ["Production Operator", s.operator],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-border/60 pb-1.5">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold">Material consumption</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  <th className="border-b border-border py-2 text-left">Material</th>
                  <th className="border-b border-border py-2 text-right">Theoretical</th>
                  <th className="border-b border-border py-2 text-right">Actual</th>
                  <th className="border-b border-border py-2 text-right">Variance</th>
                </tr>
              </thead>
              <tbody>
                {s.materials.map((m) => {
                  const variance = Math.round(((m.actual - m.theoretical) / (m.theoretical || 1)) * 1000) / 10;
                  return (
                    <tr key={m.material} className="border-b border-border/60 last:border-0">
                      <td className="py-2">{m.material}</td>
                      <td className="py-2 text-right tabular-nums">
                        {num(m.theoretical)} {m.unit}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {num(m.actual)} {m.unit}
                      </td>
                      <td className={`py-2 text-right tabular-nums ${Math.abs(variance) > 2 ? "text-warning" : "text-muted-foreground"}`}>
                        {variance > 0 ? "+" : ""}
                        {variance}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <footer className="flex items-end justify-between border-t border-border pt-4 text-xs text-muted-foreground">
            <div>
              <p>Generated {dt(s.batchTime)}</p>
              <p className="mt-6 border-t border-border pt-1">Production Operator — {s.operator}</p>
            </div>
            <div className="text-right">
              <p className="mb-1">QC status</p>
              <StatusBadge status={s.qcStatus} />
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
}
