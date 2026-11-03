import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Printer,
  Calendar,
  Layers,
  Fuel,
  Building2,
  Truck,
  Scale,
  RefreshCw,
  FileSpreadsheet
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { productionApi, type DailyConsumptionData } from "@/api/production";
import { LoadingState } from "@/components/app/states";

interface DailyConsumptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: string;
}

export function DailyConsumptionDialog({ open, onOpenChange, initialDate }: DailyConsumptionDialogProps) {
  const [selectedDate, setSelectedDate] = useState(
    initialDate || new Date().toISOString().slice(0, 10)
  );

  const printAreaRef = useRef<HTMLDivElement>(null);

  const consumptionQuery = useQuery({
    queryKey: ["daily-consumption", selectedDate],
    queryFn: () => productionApi.getDailyConsumption(selectedDate).then((r) => r.data),
    enabled: open,
  });

  const data: DailyConsumptionData | undefined = consumptionQuery.data;

  function handlePrint() {
    window.print();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto print:max-w-none print:m-0 print:p-0">
        <DialogHeader className="print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Scale className="size-4" />
                </span>
                Daily Material & Fuel Consumption Report
              </DialogTitle>
              <DialogDescription className="text-xs">
                Real-time consumption aggregated from all SCADA batch sheets and transit mixer fuel logs.
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-muted/40 px-2 py-1 rounded border border-border">
                <Calendar className="size-3.5 text-muted-foreground" />
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="h-7 text-xs border-0 bg-transparent p-0 w-32 focus-visible:ring-0"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="gap-1.5 text-xs cursor-pointer"
              >
                <Printer className="size-3.5" />
                Print Daily Report
              </Button>
            </div>
          </div>
        </DialogHeader>

        {consumptionQuery.isLoading && <LoadingState rows={5} />}

        {data && (
          <div ref={printAreaRef} className="space-y-4 pt-1 print:p-6 print:space-y-6 text-foreground">
            {/* Report Header for Print */}
            <div className="text-center border-b border-border pb-3">
              <h2 className="text-lg font-black tracking-wider uppercase font-mono">
                {data.plantName || "ROXXCON RMC NAGPUR"}
              </h2>
              <p className="text-xs font-semibold text-primary">
                OFFICIAL DAILY MATERIAL & FUEL CONSUMPTION AUDIT SHEET
              </p>
              <div className="flex justify-center items-center gap-6 text-[11px] text-muted-foreground mt-1">
                <span>Production Date: <strong className="text-foreground">{data.date}</strong></span>
                <span>Batches Mixed: <strong className="text-foreground">{data.batchesCount}</strong></span>
                <span>Total Concrete: <strong className="text-emerald-400">{data.totalVolumeCum} m³</strong></span>
                <span>Total Weight: <strong className="text-foreground">{data.totalWeightMt} MT</strong></span>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
              <div className="rounded-lg border border-border p-3 bg-muted/20">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                  Total Concrete Poured
                </span>
                <span className="text-xl font-bold font-mono text-emerald-400">
                  {data.totalVolumeCum} m³
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  Across {data.sheets.length} dispatches
                </span>
              </div>

              <div className="rounded-lg border border-border p-3 bg-muted/20">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                  Total Batch Weight
                </span>
                <span className="text-xl font-bold font-mono text-foreground">
                  {data.totalWeightMt} MT
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  {data.totalWeightKg.toLocaleString()} kg
                </span>
              </div>

              <div className="rounded-lg border border-border p-3 bg-muted/20">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                  Binder Consumed
                </span>
                <span className="text-xl font-bold font-mono text-foreground">
                  {(
                    ((data.materials.find((m) => m.material.includes("Cement"))?.consumed || 0) +
                      (data.materials.find((m) => m.material.includes("Fly Ash"))?.consumed || 0)) /
                    1000
                  ).toFixed(2)}{" "}
                  MT
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  Cement + Fly Ash
                </span>
              </div>

              <div className="rounded-lg border border-border p-3 bg-muted/20">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                  Diesel Fuel Used
                </span>
                <span className="text-xl font-bold font-mono text-amber-400">
                  {data.materials.find((m) => m.material.includes("Diesel"))?.consumed || 0} L
                </span>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  Fleet & Plant Engines
                </span>
              </div>
            </div>

            {/* Material Consumption Table */}
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="bg-muted/40 px-3 py-2 border-b border-border flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Raw Material & Fuel Consumed Summary
                </h4>
                <Badge variant="outline" className="text-[10px]">
                  IS 456 / MoRTH Compliant
                </Badge>
              </div>

              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="bg-muted/20 border-b border-border text-[11px] text-muted-foreground uppercase">
                    <th className="px-3 py-2 text-left">Material Description</th>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-right">Quantity Consumed</th>
                    <th className="px-3 py-2 text-right">Metric Tons / Units</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.materials.map((m, idx) => (
                    <tr key={idx} className="hover:bg-muted/10">
                      <td className="px-3 py-2 font-sans font-semibold text-foreground">
                        {m.material}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground font-sans text-[11px]">
                        {m.category}
                      </td>
                      <td className="px-3 py-2 text-right font-bold">
                        {m.consumed.toLocaleString()} {m.unit}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {m.unit === "kg"
                          ? `${(m.consumed / 1000).toFixed(2)} MT`
                          : m.unit === "L" && m.category === "Liquid"
                          ? `${(m.consumed / 1000).toFixed(2)} KL`
                          : `${m.consumed} ${m.unit}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Batch Sheets Dispatched on Date */}
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="bg-muted/40 px-3 py-2 border-b border-border flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Dispatched Batch Sheets on {data.date}
                </h4>
                <span className="text-xs font-mono text-muted-foreground">
                  {data.sheets.length} Dockets
                </span>
              </div>

              {data.sheets.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No batch sheets posted for {data.date}. Upload or run batching to populate records.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="bg-muted/20 border-b border-border text-[11px] text-muted-foreground uppercase">
                        <th className="px-3 py-2 text-left">Docket #</th>
                        <th className="px-3 py-2 text-left">Customer / Site</th>
                        <th className="px-3 py-2 text-left">TM / Driver</th>
                        <th className="px-3 py-2 text-left">Recipe</th>
                        <th className="px-3 py-2 text-right">Qty (m³)</th>
                        <th className="px-3 py-2 text-right">Cement (kg)</th>
                        <th className="px-3 py-2 text-right">Sand (kg)</th>
                        <th className="px-3 py-2 text-right">Agg (kg)</th>
                        <th className="px-3 py-2 text-right">Water (L)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.sheets.map((s) => (
                        <tr key={s.id} className="hover:bg-muted/10">
                          <td className="px-3 py-2 font-bold text-primary">
                            {s.docketNumber}
                          </td>
                          <td className="px-3 py-2 font-sans">
                            <span className="font-semibold block">{s.customer}</span>
                            <span className="text-[10px] text-muted-foreground">{s.site}</span>
                          </td>
                          <td className="px-3 py-2 font-sans text-[11px]">
                            <span className="font-mono">{s.truck}</span> · {s.driver}
                          </td>
                          <td className="px-3 py-2 font-semibold">
                            {s.recipeName}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-emerald-400">
                            {s.volumeCum}
                          </td>
                          <td className="px-3 py-2 text-right">{s.cementKg}</td>
                          <td className="px-3 py-2 text-right">{s.sandKg}</td>
                          <td className="px-3 py-2 text-right">{s.aggKg}</td>
                          <td className="px-3 py-2 text-right">{s.waterL}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Print Sign-off Signatures */}
            <div className="hidden print:grid grid-cols-3 gap-6 pt-8 text-center text-xs border-t border-border mt-8">
              <div>
                <div className="h-10 border-b border-foreground/30 mb-1"></div>
                <span>Plant Batching Operator</span>
              </div>
              <div>
                <div className="h-10 border-b border-foreground/30 mb-1"></div>
                <span>Quality Incharge / Lab Chemist</span>
              </div>
              <div>
                <div className="h-10 border-b border-foreground/30 mb-1"></div>
                <span>Plant General Manager</span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
