import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Boxes, PackagePlus, Loader2, Sparkles } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { storeApi } from "@/api/store";

interface AddMaterialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMaterialCreated?: (material: any) => void;
}

export function AddMaterialDialog({ open, onOpenChange, onMaterialCreated }: AddMaterialDialogProps) {
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("ADMIXTURE");
  const [unit, setUnit] = useState("kg");
  const [siloName, setSiloName] = useState("");
  const [initialStock, setInitialStock] = useState("0");
  const [reorderLevel, setReorderLevel] = useState("1000");
  const [density, setDensity] = useState("1.0");
  const [isTracked, setIsTracked] = useState(true);

  const createMaterialMutation = useMutation({
    mutationFn: () =>
      storeApi.createMaterial({
        name: name.trim(),
        unit: unit.trim(),
        category,
        siloName: siloName.trim() || undefined,
        initialStock: Math.max(0, Number(initialStock) || 0),
        reorderLevel: Math.max(0, Number(reorderLevel) || 1000),
        density: Number(density) || 1.0,
        isTracked,
      }),
    onSuccess: (res) => {
      toast.success(res.message || `Material "${name}" added to inventory!`);
      void qc.invalidateQueries({ queryKey: ["inventory"] });
      void qc.invalidateQueries({ queryKey: ["stock-transactions"] });
      void qc.invalidateQueries({ queryKey: ["reports"] });
      onMaterialCreated?.(res.data);
      onOpenChange(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to create material. Please verify name is unique.");
    },
  });

  function resetForm() {
    setName("");
    setCategory("ADMIXTURE");
    setUnit("kg");
    setSiloName("");
    setInitialStock("0");
    setReorderLevel("1000");
    setDensity("1.0");
    setIsTracked(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a material name.");
      return;
    }
    createMaterialMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <PackagePlus className="size-4.5" />
            </span>
            <div>
              <DialogTitle className="text-base font-bold">Add New Material to Inventory</DialogTitle>
              <DialogDescription className="text-xs">
                Register raw materials, specialty additives, or bulk consumables for silo tracking and batching sync.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2 text-xs">
          <div className="space-y-1">
            <Label htmlFor="mat-name" className="text-xs">
              Material Name *
            </Label>
            <Input
              id="mat-name"
              placeholder="e.g. Micro Silica, Retarder-100, Steel Fiber, GGBS 120"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-8 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={(val) => {
                setCategory(val);
                if (val === "ADMIXTURE" || val === "WATER" || val === "FUEL") {
                  setUnit("l");
                  setSiloName(val === "FUEL" ? "Diesel Storage Silo" : "Liquid Storage Tank");
                } else if (val === "SAND" || val === "AGGREGATE") {
                  setUnit("kg");
                  setSiloName("Aggregate Storage Bay");
                } else {
                  setUnit("kg");
                  setSiloName("Vertical Silo Bin");
                }
              }}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CEMENT">Cementitious (Cement)</SelectItem>
                  <SelectItem value="SUPPLEMENTARY">Fly Ash / GGBS / Slag</SelectItem>
                  <SelectItem value="SAND">Sand (River / M-Sand)</SelectItem>
                  <SelectItem value="AGGREGATE">Aggregate (10mm / 20mm)</SelectItem>
                  <SelectItem value="ADMIXTURE">Admixture / Retarder / Chemical</SelectItem>
                  <SelectItem value="FUEL">Fuel / Diesel</SelectItem>
                  <SelectItem value="WATER">Water Utility</SelectItem>
                  <SelectItem value="CONSUMABLE">Specialty Fibers / Color Pigments</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Unit of Measurement *</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg (Kilograms)</SelectItem>
                  <SelectItem value="l">l (Liters)</SelectItem>
                  <SelectItem value="MT">MT (Metric Tonnes)</SelectItem>
                  <SelectItem value="bag">bag (50kg Bags)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="mat-silo" className="text-xs">Storage Silo / Location</Label>
              <Input
                id="mat-silo"
                placeholder="e.g. Silo Bin 4, Chemical Bay"
                value={siloName}
                onChange={(e) => setSiloName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="mat-reorder" className="text-xs">Reorder Alert Threshold ({unit})</Label>
              <Input
                id="mat-reorder"
                type="number"
                min="0"
                step="any"
                placeholder="1000"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="mat-opening" className="text-xs">Initial Opening Stock ({unit})</Label>
              <Input
                id="mat-opening"
                type="number"
                min="0"
                step="any"
                placeholder="0"
                value={initialStock}
                onChange={(e) => setInitialStock(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="mat-density" className="text-xs">Density (kg/L, default 1.0)</Label>
              <Input
                id="mat-density"
                type="number"
                step="0.01"
                min="0.1"
                placeholder="1.0"
                value={density}
                onChange={(e) => setDensity(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-1 border-t border-border">
            <Checkbox
              id="mat-tracked"
              checked={isTracked}
              onCheckedChange={(checked) => setIsTracked(Boolean(checked))}
            />
            <Label htmlFor="mat-tracked" className="text-xs font-normal cursor-pointer">
              Track physical inventory in silos & enforce gate inward reconciliation
            </Label>
          </div>

          <DialogFooter className="pt-3 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createMaterialMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {createMaterialMutation.isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Register Material
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
