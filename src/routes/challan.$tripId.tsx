import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/app/states";
import { tripsApi } from "@/api/trips";
import { PLANT_NAME } from "@/lib/mock-data";
import { cum, dt } from "@/lib/format";

export const Route = createFileRoute("/challan/$tripId")({
  head: () => ({
    meta: [
      { title: "Delivery Challan · RMC Command Center" },
      { name: "description", content: "Printable three-copy delivery challan for a dispatched concrete trip." },
      { property: "og:title", content: "Delivery Challan · RMC Command Center" },
      { property: "og:description", content: "Printable three-copy delivery challan for a dispatched concrete trip." },
    ],
  }),
  component: ChallanPage,
});

const COPIES = ["Customer Copy", "Plant Copy", "Driver Copy"];

function ChallanPage() {
  const { tripId } = Route.useParams();
  const navigate = useNavigate();
  const trip = useQuery({ queryKey: ["trip", tripId], queryFn: () => tripsApi.get(tripId).then((r) => r.data) });

  if (trip.isLoading) return <div className="p-6"><LoadingState rows={4} /></div>;
  if (trip.error || !trip.data) return <div className="p-6"><ErrorState message="This challan could not be found." /></div>;

  const t = trip.data;
  const isQcApproved = ["QC_APPROVED", "DISPATCHED", "DELIVERED"].includes(t.status);

  const originParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("from") : null;
  const handleBack = () => {
    if (originParam === "portal") {
      void navigate({ to: "/portal" });
    } else if (originParam === "supervisor") {
      void navigate({ to: "/supervisor" });
    } else if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      void navigate({ to: "/dispatcher" });
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="no-print flex items-center justify-between">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="size-4" /> Back
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="size-4" /> Print challan
          </Button>
        </div>

        {COPIES.map((copy) => (
          <article key={copy} className="panel space-y-4 p-6 print:break-after-page print:border-0">
            <header className="flex items-start justify-between gap-4 border-b border-border pb-3">
              <div>
                <p className="text-base font-semibold">RMC Command Center</p>
                <p className="text-xs text-muted-foreground">{PLANT_NAME}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Delivery Challan · {copy}</p>
                <p className="text-base font-semibold">{t.challanNumber ?? "Pending release"}</p>
              </div>
            </header>

            <section className="grid gap-2.5 text-sm sm:grid-cols-2">
              {[
                ["Customer", t.customerName],
                ["Site", t.siteName],
                ["Purchase Order", t.poNumber],
                ["Trip", t.tripNumber],
                ["Transit Mixer", t.tmCode],
                ["Driver", t.driverName],
                ["Grade", t.grade],
                ["Quantity", cum(t.quantity)],
                ["Dispatch Time", t.dispatchTime ? dt(t.dispatchTime) : "—"],
                ["Delivered To", t.receiverName ?? "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-border/60 pb-1.5">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </section>

            <footer className="flex items-end justify-between pt-3 text-xs text-muted-foreground">
              <div>
                <p className="mt-8 border-t border-border pt-1">Dispatcher signature</p>
              </div>
              {isQcApproved && (
                <div className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-success">
                  <p className="flex items-center gap-1.5 text-xs font-semibold">
                    <BadgeCheck className="size-3.5" /> QC APPROVED
                  </p>
                  <p className="mt-0.5 text-[11px]">
                    IS 456 / IS 10262 Verified · Slump OK
                  </p>
                </div>
              )}
            </footer>
          </article>
        ))}
      </div>
    </div>
  );
}
