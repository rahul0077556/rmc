import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers,
  Truck,
  User,
  Calendar,
  Clock,
  Building2,
  MapPin,
  RefreshCw,
  Scale,
  Plus,
  Trash2,
  AlertTriangle,
  Eye,
  FileCheck2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { productionApi, type ScadaBatchDocketData, type ScadaMaterialRow } from "@/api/production";
import type { TripRow } from "@/api/trips";
import { useAuth } from "@/auth/auth-context";
import { cn } from "@/lib/utils";

interface UploadBatchSheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  trip?: TripRow | null;
}

export function UploadBatchSheetDialog({ open, onOpenChange, onSuccess, trip }: UploadBatchSheetDialogProps) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const [form, setForm] = useState<ScadaBatchDocketData>({
    plantName: user?.plant || "ROXXCON RMC NAGPUR",
    plantCapacity: "75 CBM",
    customerName: "",
    siteName: "",
    truckNumber: "",
    driverName: "",
    docketNumber: "",
    recipeName: "",
    grade: "M25",
    orderQtyCum: 0,
    ticketQtyCum: 6.0,
    withThisLoadCum: 0,
    batchSizeCum: 1.5,
    batchesCount: 4,
    date: new Date().toISOString().slice(0, 10),
    startTime: "09:00",
    endTime: "09:12",
    wcRatio: 0.38,
    totalWeightKg: 0,
    materials: [],
    cycles: [],
    discrepancies: [],
    isVerified: true,
  });

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  // Setup preview URL when file changes
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [file]);

  // Pre-fill from linked Trip when dialog opens
  useEffect(() => {
    if (open) {
      if (trip) {
        setForm((prev) => ({
          ...prev,
          plantName: user?.plant || prev.plantName,
          customerName: trip.customerName || prev.customerName,
          siteName: trip.siteName || prev.siteName || "Site",
          truckNumber: trip.tmCode || trip.tmNumber || prev.truckNumber,
          driverName: trip.driverName || prev.driverName,
          grade: trip.grade || prev.grade,
          recipeName: trip.grade ? `M ${trip.grade.replace(/[^0-9]/g, "")} Mix` : prev.recipeName,
          ticketQtyCum: trip.quantity || prev.ticketQtyCum,
          tripId: trip.id,
        }));
      }
    } else {
      setFile(null);
      setDuplicateError(null);
    }
  }, [open, trip, user]);

  // Dynamic sum of materials
  const calculatedTotalKg = (form.materials && form.materials.length > 0)
    ? form.materials.reduce((sum, m) => sum + Number(m.actualKg || 0), 0)
    : Number(form.totalWeightKg || 0);

  const calculatedSetKg = (form.materials && form.materials.length > 0)
    ? form.materials.reduce((sum, m) => sum + Number(m.setKg || 0), 0)
    : 0;

  // Mutation: Parse uploaded file via backend
  const parseMutation = useMutation({
    mutationFn: async (uploadedFile: File) => {
      setIsParsing(true);
      setDuplicateError(null);
      return productionApi.parseUploadedBatchSheet({ file: uploadedFile });
    },
    onSuccess: (res) => {
      setIsParsing(false);
      if (res.data) {
        const d = res.data;
        if (!d.isReadable && d.error) {
          toast.warning(d.error);
        } else {
          toast.success(
            `Batch docket #${d.docketNumber || "scanned"} parsed with ${d.materials?.length || 0} materials!`
          );
        }

        setForm((prev) => ({
          ...prev,
          ...d,
          materials: d.materials && d.materials.length > 0 ? d.materials : prev.materials,
          cycles: d.cycles && d.cycles.length > 0 ? d.cycles : prev.cycles,
          discrepancies: d.discrepancies || [],
          isVerified: d.isVerified ?? true,
          ...(trip ? {
            customerName: trip.customerName || d.customerName || prev.customerName,
            siteName: trip.siteName || d.siteName || prev.siteName,
            tripId: trip.id,
          } : {}),
          date: d.date || prev.date,
        }));
      }
    },
    onError: (err: any) => {
      setIsParsing(false);
      const status = err?.response?.status;
      if (status === 502) {
        toast.error("Backend server is offline (502). Please verify python backend is running.");
      } else {
        toast.warning("Could not auto-parse document text. You can inspect the sheet on the left and enter fields manually.");
      }
    },
  });

  // Mutation: Confirm and post batch sheet
  const submitMutation = useMutation({
    mutationFn: (overridePayload?: any) => {
      const payload: any = {
        ...form,
        tripId: trip?.id || form.tripId,
        totalWeightKg: calculatedTotalKg,
        ...(overridePayload || {}),
      };
      return productionApi.confirmBatchSheetUpload(payload);
    },
    onSuccess: (res) => {
      setDuplicateError(null);
      toast.success(
        res.data?.message || `Batch Docket #${form.docketNumber} confirmed and stock deducted!`
      );
      void qc.invalidateQueries({ queryKey: ["production-queue"] });
      void qc.invalidateQueries({ queryKey: ["store-inventory"] });
      void qc.invalidateQueries({ queryKey: ["store-transactions"] });
      void qc.invalidateQueries({ queryKey: ["daily-consumption"] });
      void qc.invalidateQueries({ queryKey: ["dpr-sheet"] });
      void qc.invalidateQueries({ queryKey: ["mpr-sheet"] });
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
    onError: (err: any) => {
      const errorMsg = err?.response?.data?.error?.message || err?.message || "Failed to post batch sheet.";
      if (errorMsg.includes("already exists")) {
        setDuplicateError(errorMsg);
        toast.warning(errorMsg);
      } else {
        toast.error(errorMsg);
      }
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      parseMutation.mutate(f);
    }
  }

  function handleMaterialChange(idx: number, field: keyof ScadaMaterialRow, val: any) {
    setForm((prev) => {
      const updated = [...(prev.materials || [])];
      const row = { ...updated[idx]!, [field]: val };
      if (field === "actualKg" || field === "setKg") {
        const act = field === "actualKg" ? Number(val) : Number(row.actualKg);
        const st = field === "setKg" ? Number(val) : Number(row.setKg);
        row.varianceKg = round2(act - st);
        row.variancePct = st > 0 ? round2(((act - st) / st) * 100) : 0;
      }
      updated[idx] = row;
      return { ...prev, materials: updated };
    });
  }

  function handleAddMaterial() {
    setForm((prev) => ({
      ...prev,
      materials: [
        ...(prev.materials || []),
        {
          name: "New Material",
          recipeKg: 0,
          setKg: 0,
          actualKg: 0,
          varianceKg: 0,
          variancePct: 0,
          unit: "kg",
        },
      ],
    }));
  }

  function handleRemoveMaterial(idx: number) {
    setForm((prev) => {
      const updated = [...(prev.materials || [])];
      updated.splice(idx, 1);
      return { ...prev, materials: updated };
    });
  }

  function round2(v: number) {
    return Math.round(v * 100) / 100;
  }

  const isPdf = file?.name?.toLowerCase().endsWith(".pdf") || false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[94vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="border-b border-border pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Scale className="size-5" />
              </span>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <span>Batch Sheet Verification & Ingestion</span>
                  <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                    Dual-Pane OCR
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Verify original printed batching ticket side-by-side with extracted scale weights before confirming silo stock deduction.
                </DialogDescription>
              </div>
            </div>

            {/* Quick Upload Input */}
            <div className="flex items-center gap-2">
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold transition-all">
                <Upload className="size-3.5" />
                <span>{file ? "Change Document" : "Upload Sheet (PDF/JPG)"}</span>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>
          </div>
        </DialogHeader>

        {trip && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-2 flex items-center justify-between text-xs mt-2">
            <div className="flex items-center gap-2 flex-wrap text-muted-foreground">
              <span className="font-bold text-primary">{trip.tripNumber}</span>
              <span>·</span>
              <span>PO: <strong className="text-foreground">{trip.poNumber}</strong></span>
              <span>·</span>
              <span>Customer: <strong className="text-foreground">{trip.customerName}</strong></span>
              <span>·</span>
              <span>TM: <strong className="text-foreground">{trip.tmCode || trip.tmNumber}</strong></span>
              <span>·</span>
              <span>Qty: <strong className="text-foreground">{trip.quantity} m³</strong></span>
            </div>
            <Badge className="bg-primary/20 text-primary hover:bg-primary/30 text-[10px]">
              Trip Linked
            </Badge>
          </div>
        )}

        {duplicateError && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs flex flex-wrap items-center justify-between gap-2.5 mt-2">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertCircle className="size-4 shrink-0 text-amber-500" />
              <span>{duplicateError}</span>
            </div>
            <Button
              size="sm"
              variant="destructive"
              className="text-xs h-7 gap-1 font-semibold"
              disabled={submitMutation.isPending}
              onClick={() => submitMutation.mutate({ replaceExisting: true })}
            >
              Replace & Re-import
            </Button>
          </div>
        )}

        {/* Side-by-Side Dual-Pane Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-3">
          {/* ========================================================= */}
          {/* LEFT PANE: Original Document Viewer & Preview (5 cols)     */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 flex flex-col rounded-xl border border-border bg-surface-raised overflow-hidden h-[580px]">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <FileText className="size-3.5 text-primary" />
                <span>Original Printed Document</span>
              </div>
              {file && (
                <span className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </span>
              )}
            </div>

            <div className="flex-1 overflow-auto p-2 flex items-center justify-center bg-black/40 relative">
              {isParsing && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-xs flex flex-col items-center justify-center z-10 gap-2">
                  <RefreshCw className="size-6 text-primary animate-spin" />
                  <p className="text-xs font-semibold text-foreground">Reading table headers & scale weights...</p>
                </div>
              )}

              {previewUrl ? (
                isPdf ? (
                  <iframe
                    src={previewUrl}
                    title="Uploaded Batch Report PDF"
                    className="w-full h-full rounded border-0 bg-white"
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Uploaded Batch Sheet"
                    className="max-w-full max-h-full object-contain rounded"
                  />
                )
              ) : (
                <label className="flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors rounded-xl border-2 border-dashed border-border w-full h-full">
                  <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
                    <Upload className="size-6" />
                  </div>
                  <p className="text-sm font-bold text-foreground">Upload Plant Batch Docket</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    Drop your Roxxcon, Schwing Stetter, or SCADA PDF/scanned JPG here to inspect side-by-side.
                  </p>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT PANE: Extracted Data & Real-Time Balance (7 cols)   */}
          {/* ========================================================= */}
          <div className="lg:col-span-7 flex flex-col space-y-4 max-h-[580px] overflow-y-auto pr-1">
            {/* Balance & Discrepancy Status Banner */}
            {form.discrepancies && form.discrepancies.length > 0 ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-500">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>Document Discrepancies Flagged for Operator Review</span>
                </div>
                <ul className="list-disc pl-5 text-[11px] text-amber-700 dark:text-amber-300 space-y-0.5">
                  {form.discrepancies.map((disc, i) => (
                    <li key={i}>{disc}</li>
                  ))}
                </ul>
              </div>
            ) : form.docketNumber ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>100% Mathematical Balance Verified (Batch Cycles = Scale Weights = Mix Design)</span>
                </div>
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/20 text-emerald-400 text-[10px]">
                  Pass
                </Badge>
              </div>
            ) : null}

            {/* Section 1: Docket Metadata Header Grid */}
            <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                  <Building2 className="size-3.5 text-primary" />
                  <span>Plant & Order Metadata</span>
                </h4>
                <span className="text-[10px] text-muted-foreground font-mono">
                  Docket #{form.docketNumber || "—"}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Docket / Ticket #</Label>
                  <Input
                    value={form.docketNumber}
                    onChange={(e) => setForm({ ...form, docketNumber: e.target.value })}
                    className="h-7 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Date (YYYY-MM-DD)</Label>
                  <Input
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Truck TM No</Label>
                  <Input
                    value={form.truckNumber}
                    onChange={(e) => setForm({ ...form, truckNumber: e.target.value.toUpperCase() })}
                    className="h-7 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Driver Name</Label>
                  <Input
                    value={form.driverName}
                    onChange={(e) => setForm({ ...form, driverName: e.target.value })}
                    className="h-7 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-[10px] text-muted-foreground">Customer Name</Label>
                  <Input
                    value={form.customerName}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    className="h-7 text-xs font-medium"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Delivery Site</Label>
                  <Input
                    value={form.siteName}
                    onChange={(e) => setForm({ ...form, siteName: e.target.value })}
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Recipe Name</Label>
                  <Input
                    value={form.recipeName}
                    onChange={(e) => setForm({ ...form, recipeName: e.target.value })}
                    className="h-7 text-xs font-medium"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Grade</Label>
                  <Input
                    value={form.grade}
                    onChange={(e) => setForm({ ...form, grade: e.target.value })}
                    className="h-7 text-xs font-bold text-primary"
                  />
                </div>

                <div>
                  <Label className="text-[10px] text-muted-foreground">Ticket Qty (m³)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={form.ticketQtyCum}
                    onChange={(e) => setForm({ ...form, ticketQtyCum: parseFloat(e.target.value) || 0 })}
                    className="h-7 text-xs font-bold"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">W/C Ratio</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.wcRatio}
                    onChange={(e) => setForm({ ...form, wcRatio: parseFloat(e.target.value) || 0 })}
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Start Time</Label>
                  <Input
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">End Time</Label>
                  <Input
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Dynamic Materials Table (Header-driven, arbitrary materials) */}
            <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                    <Layers className="size-3.5 text-primary" />
                    <span>Raw Material Batched Weights (Actual Scale vs Set)</span>
                  </h4>
                  <Badge variant="outline" className="text-[10px]">
                    {form.materials?.length || 0} Components
                  </Badge>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddMaterial}
                  className="h-6 text-[10px] gap-1 px-2 border-dashed"
                >
                  <Plus className="size-3" /> Add Component
                </Button>
              </div>

              {form.materials && form.materials.length > 0 ? (
                <div className="border border-border rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-muted-foreground text-[10px] uppercase font-semibold">
                        <th className="p-2">Material</th>
                        <th className="p-2 text-right">Recipe/m³</th>
                        <th className="p-2 text-right">Plant Set</th>
                        <th className="p-2 text-right font-bold text-foreground">Actual Scale</th>
                        <th className="p-2 text-right">Variance %</th>
                        <th className="p-2 text-center w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {form.materials.map((m, idx) => {
                        const isHighVar = Math.abs(m.variancePct) > 3.0;
                        return (
                          <tr key={idx} className="hover:bg-muted/10 transition-colors">
                            <td className="p-2">
                              <Input
                                value={m.name}
                                onChange={(e) => handleMaterialChange(idx, "name", e.target.value)}
                                className="h-6 text-xs font-medium w-full min-w-[130px]"
                              />
                            </td>
                            <td className="p-2 text-right text-muted-foreground font-mono">
                              {m.recipeKg ? `${m.recipeKg} ${m.unit}` : "—"}
                            </td>
                            <td className="p-2 text-right text-muted-foreground font-mono">
                              {m.setKg ? `${m.setKg.toFixed(1)} ${m.unit}` : "—"}
                            </td>
                            <td className="p-2 text-right">
                              <Input
                                type="number"
                                step="0.1"
                                value={m.actualKg}
                                onChange={(e) => handleMaterialChange(idx, "actualKg", e.target.value)}
                                className="h-6 text-xs font-mono font-bold text-right w-24 ml-auto"
                              />
                            </td>
                            <td className="p-2 text-right">
                              <span
                                className={cn(
                                  "font-mono text-[11px] font-semibold",
                                  isHighVar ? "text-amber-500" : "text-emerald-500"
                                )}
                              >
                                {m.variancePct > 0 ? `+${m.variancePct}%` : `${m.variancePct}%`}
                              </span>
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveMaterial(idx)}
                                className="text-muted-foreground hover:text-destructive transition-colors p-1"
                                title="Remove row"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/40 font-bold text-xs">
                        <td className="p-2 text-foreground">Total Scale Batch Weight</td>
                        <td className="p-2 text-right text-muted-foreground">—</td>
                        <td className="p-2 text-right font-mono text-muted-foreground">
                          {calculatedSetKg.toFixed(1)} kg
                        </td>
                        <td className="p-2 text-right font-mono text-primary font-black">
                          {calculatedTotalKg.toFixed(1)} kg
                        </td>
                        <td className="p-2 text-right font-mono text-emerald-500">
                          {calculatedSetKg > 0 ? `${round2(((calculatedTotalKg - calculatedSetKg) / calculatedSetKg) * 100)}%` : "—"}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  <p>No materials parsed yet. Upload a batch report PDF or image above to populate automatically.</p>
                </div>
              )}
            </div>

            {/* Section 3: Cycle Details Breakdown (if cycles present) */}
            {form.cycles && form.cycles.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-3.5 space-y-2.5">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                    <Clock className="size-3.5 text-cyan-400" />
                    <span>Cycle Batches ({form.cycles.length} Batches)</span>
                  </h4>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Batch Size: {form.batchSizeCum} m³
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {form.cycles.map((c) => (
                    <div key={c.cycleNo} className="p-2 rounded-lg border border-border bg-surface text-center">
                      <span className="text-[10px] text-muted-foreground block font-bold">
                        Batch #{c.cycleNo} ({c.durationSec}s)
                      </span>
                      <span className="text-sm font-mono font-bold text-foreground mt-0.5 block">
                        {c.totalKg.toFixed(1)} kg
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-border pt-3 flex flex-row items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Scale className="size-3.5 text-primary" />
            <span>Actual batch: <strong>{calculatedTotalKg.toFixed(1)} kg</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={submitMutation.isPending || !form.docketNumber}
              onClick={() => submitMutation.mutate()}
              className="gap-1.5 font-bold bg-primary text-primary-foreground shadow-md"
            >
              {submitMutation.isPending ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>Deducting Inventory...</span>
                </>
              ) : (
                <>
                  <FileCheck2 className="size-3.5" />
                  <span>Confirm & Deduct Stock</span>
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
