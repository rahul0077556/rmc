import { useState } from "react";
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
  Scale
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
import { productionApi, type ScadaBatchDocketData } from "@/api/production";

interface UploadBatchSheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const DEFAULT_DOCKET: ScadaBatchDocketData = {
  plantName: "ROXXCON RMC NAGPUR",
  plantCapacity: "75 CBM",
  customerName: "LIGHT HOUSE SYSTEM",
  siteName: "IT PARK",
  truckNumber: "MH40DC3964",
  driverName: "VIKASH",
  docketNumber: "5703",
  recipeName: "M 25 LIGTH",
  grade: "M25",
  orderQtyCum: 50.0,
  ticketQtyCum: 5.0,
  withThisLoadCum: 17.0,
  batchSizeCum: 1.25,
  batchesCount: 4,
  date: new Date().toISOString().slice(0, 10),
  startTime: "19:18:58",
  endTime: "19:26:10",
  wcRatio: 0.39,
  thVolume: 2508.87,
  rSandKg: 2361.0,
  mSandKg: 1578.0,
  agg10mmKg: 2217.0,
  agg20mmKg: 3436.0,
  cementKg: 1599.6,
  flyashKg: 449.7,
  waterL: 894.1,
  admixtureKg: 14.19,
  totalWeightKg: 12550.38,
};

export function UploadBatchSheetDialog({ open, onOpenChange, onSuccess }: UploadBatchSheetDialogProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ScadaBatchDocketData>({ ...DEFAULT_DOCKET });
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  // Recalculate total weight dynamically when components change
  const calculatedTotalKg =
    Number(form.cementKg || 0) +
    Number(form.flyashKg || 0) +
    Number(form.rSandKg || 0) +
    Number(form.mSandKg || 0) +
    Number(form.agg10mmKg || 0) +
    Number(form.agg20mmKg || 0) +
    Number(form.waterL || 0) +
    Number(form.admixtureKg || 0);

  // Mutation: Parse uploaded file
  const parseMutation = useMutation({
    mutationFn: async (uploadedFile: File) => {
      setIsParsing(true);
      return productionApi.parseUploadedBatchSheet({ file: uploadedFile });
    },
    onSuccess: (res) => {
      setIsParsing(false);
      if (res.data) {
        setForm((prev) => ({
          ...prev,
          ...res.data,
          date: res.data.date || prev.date,
        }));
        toast.success(
          `Batch docket #${res.data.docketNumber || "scanned"} parsed successfully!`
        );
      }
    },
    onError: (err: any) => {
      setIsParsing(false);
      const status = err?.response?.status;
      if (status === 502) {
        toast.error("Backend server is offline (502). Please start backend with: python backend/wsgi.py");
      } else {
        toast.warning("Could not auto-parse document text. You can verify and edit the fields below manually.");
      }
    },
  });

  // Mutation: Confirm and post batch sheet
  const submitMutation = useMutation({
    mutationFn: () => {
      const payload: ScadaBatchDocketData = {
        ...form,
        totalWeightKg: calculatedTotalKg,
      };
      return productionApi.confirmBatchSheetUpload(payload);
    },
    onSuccess: (res) => {
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
      const status = err?.response?.status;
      if (status === 502) {
        toast.error("Backend server is offline (502). Please start backend with: python backend/wsgi.py");
      } else {
        toast.error(
          err?.response?.data?.error?.message || err?.message || "Failed to post batch sheet."
        );
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

  function handleLoadSample() {
    setForm({ ...DEFAULT_DOCKET });
    toast.info("Loaded reference Roxxcon Docket #5703 data from plant report.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Scale className="size-5" />
              </span>
              <div>
                <DialogTitle className="text-base font-bold">
                  Upload & Post SCADA Batch Report
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Read printed batching plant delivery sheets (Roxxcon, Schwing Stetter, Aquarius). Deducts actual scale weights from silo inventory.
                </DialogDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadSample}
              className="text-xs border-dashed gap-1.5"
            >
              <Sparkles className="size-3.5 text-amber-500" />
              Sample Docket (#5703)
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* File Upload Zone */}
          <div className="rounded-lg border-2 border-dashed border-border p-4 text-center hover:border-primary/50 transition-colors bg-muted/20">
            <input
              type="file"
              id="batch-file-input"
              accept=".jpg,.jpeg,.png,.pdf,.txt"
              className="hidden"
              onChange={handleFileChange}
            />
            <label
              htmlFor="batch-file-input"
              className="flex flex-col items-center justify-center cursor-pointer gap-2"
            >
              <Upload className="size-7 text-muted-foreground" />
              <div className="text-xs">
                <span className="font-semibold text-primary">Click to upload batch report</span> or drag & drop photo/scan
              </div>
              <p className="text-[11px] text-muted-foreground">
                Supported: JPG, PNG, PDF batch reports (e.g. ROXXCON, Stetter SCADA docket)
              </p>
              {file && (
                <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                  <FileText className="size-3.5" />
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  {isParsing && <RefreshCw className="size-3 animate-spin ml-1 text-primary" />}
                </div>
              )}
            </label>
          </div>

          {/* Plant & Docket Header Grid */}
          <div className="rounded-lg border border-border p-3 space-y-3 bg-card/60">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Building2 className="size-3.5 text-primary" />
              Plant & Order Docket Metadata
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="space-y-1">
                <Label className="text-[11px]">Docket / Ticket # *</Label>
                <Input
                  value={form.docketNumber}
                  onChange={(e) => setForm({ ...form, docketNumber: e.target.value })}
                  placeholder="5703"
                  className="h-8 font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Plant Name</Label>
                <Input
                  value={form.plantName}
                  onChange={(e) => setForm({ ...form, plantName: e.target.value })}
                  placeholder="ROXXCON RMC NAGPUR"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Customer Name *</Label>
                <Input
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  placeholder="LIGHT HOUSE SYSTEM"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Site Name *</Label>
                <Input
                  value={form.siteName}
                  onChange={(e) => setForm({ ...form, siteName: e.target.value })}
                  placeholder="IT PARK"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Truck No (TM) *</Label>
                <Input
                  value={form.truckNumber}
                  onChange={(e) => setForm({ ...form, truckNumber: e.target.value.toUpperCase() })}
                  placeholder="MH40DC3964"
                  className="h-8 font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Driver Name</Label>
                <Input
                  value={form.driverName}
                  onChange={(e) => setForm({ ...form, driverName: e.target.value })}
                  placeholder="VIKASH"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Recipe / Grade</Label>
                <Input
                  value={form.recipeName}
                  onChange={(e) => setForm({ ...form, recipeName: e.target.value })}
                  placeholder="M 25 LIGTH"
                  className="h-8 text-xs font-semibold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Ticket Qty (m³) *</Label>
                <Input
                  type="number"
                  step="0.25"
                  value={form.ticketQtyCum || ""}
                  onChange={(e) => setForm({ ...form, ticketQtyCum: Number(e.target.value) })}
                  placeholder="5.00"
                  className="h-8 font-mono text-xs font-bold text-primary"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Date (YYYY-MM-DD)</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">W/C Ratio</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.wcRatio || ""}
                  onChange={(e) => setForm({ ...form, wcRatio: Number(e.target.value) })}
                  className="h-8 font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Batch Size (m³)</Label>
                <Input
                  type="number"
                  step="0.25"
                  value={form.batchSizeCum || ""}
                  onChange={(e) => setForm({ ...form, batchSizeCum: Number(e.target.value) })}
                  className="h-8 font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">Batches Count</Label>
                <Input
                  type="number"
                  value={form.batchesCount || ""}
                  onChange={(e) => setForm({ ...form, batchesCount: Number(e.target.value) })}
                  className="h-8 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* Actual Weights Consumed Table */}
          <div className="rounded-lg border border-border p-3 space-y-3 bg-card/60">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Scale className="size-3.5 text-primary" />
                Actual Material Batch Weights (kg / L)
              </h4>
              <span className="text-xs font-mono font-bold text-emerald-400">
                Total Weight: {(calculatedTotalKg / 1000).toFixed(2)} MT ({calculatedTotalKg.toFixed(1)} kg)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Cement OPC 53 (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.cementKg || ""}
                  onChange={(e) => setForm({ ...form, cementKg: Number(e.target.value) })}
                  className="h-8 font-mono text-xs text-right"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Fly Ash (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.flyashKg || ""}
                  onChange={(e) => setForm({ ...form, flyashKg: Number(e.target.value) })}
                  className="h-8 font-mono text-xs text-right"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">River Sand (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.rSandKg || ""}
                  onChange={(e) => setForm({ ...form, rSandKg: Number(e.target.value) })}
                  className="h-8 font-mono text-xs text-right"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">M-Sand (Crushed) (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.mSandKg || ""}
                  onChange={(e) => setForm({ ...form, mSandKg: Number(e.target.value) })}
                  className="h-8 font-mono text-xs text-right"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Aggregate 10mm (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.agg10mmKg || ""}
                  onChange={(e) => setForm({ ...form, agg10mmKg: Number(e.target.value) })}
                  className="h-8 font-mono text-xs text-right"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Aggregate 20mm (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.agg20mmKg || ""}
                  onChange={(e) => setForm({ ...form, agg20mmKg: Number(e.target.value) })}
                  className="h-8 font-mono text-xs text-right"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Water (L)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.waterL || ""}
                  onChange={(e) => setForm({ ...form, waterL: Number(e.target.value) })}
                  className="h-8 font-mono text-xs text-right"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Admixture (kg)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.admixtureKg || ""}
                  onChange={(e) => setForm({ ...form, admixtureKg: Number(e.target.value) })}
                  className="h-8 font-mono text-xs text-right"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={
              submitMutation.isPending ||
              !form.customerName.trim() ||
              !form.truckNumber.trim() ||
              !form.docketNumber.trim() ||
              calculatedTotalKg <= 0
            }
            onClick={() => submitMutation.mutate()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold cursor-pointer gap-1.5"
          >
            <CheckCircle2 className="size-4" />
            Confirm & Post Batch Sheet to Inventory
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

