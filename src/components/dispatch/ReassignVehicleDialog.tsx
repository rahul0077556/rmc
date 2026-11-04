import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Truck, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";
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
import { tripsApi, type TripRow } from "@/api/trips";

interface ReassignVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: TripRow | null;
  onReassigned?: (trip: TripRow) => void;
}

export function ReassignVehicleDialog({
  open,
  onOpenChange,
  trip,
  onReassigned,
}: ReassignVehicleDialogProps) {
  const qc = useQueryClient();

  const [selectedTruckId, setSelectedTruckId] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [reason, setReason] = useState("Flat tyre / tyre puncture at plant");
  const [customReason, setCustomReason] = useState("");
  const [markBreakdown, setMarkBreakdown] = useState(true);

  const trucksQuery = useQuery({
    queryKey: ["trucks"],
    queryFn: () => tripsApi.trucks().then((r) => r.data || []),
  });

  const driversQuery = useQuery({
    queryKey: ["drivers"],
    queryFn: () => tripsApi.drivers().then((r) => r.data || []),
  });

  useEffect(() => {
    if (open && trip) {
      setSelectedTruckId("");
      setSelectedDriverId(trip.driverId || "");
      setReason("Flat tyre / tyre puncture at plant");
      setCustomReason("");
      setMarkBreakdown(true);
    }
  }, [open, trip]);

  const reassignMutation = useMutation({
    mutationFn: () => {
      if (!trip) throw new Error("No trip selected");
      const effectiveReason = reason === "Other" ? customReason.trim() : reason;
      return tripsApi.reassignVehicle(trip.id, {
        tmId: selectedTruckId,
        driverId: selectedDriverId || undefined,
        reason: effectiveReason || "Vehicle breakdown/swap",
        markOldTruckBreakdown: markBreakdown,
      });
    },
    onSuccess: (res) => {
      toast.success(res.message || "Transit mixer swapped successfully!");
      void qc.invalidateQueries({ queryKey: ["trips"] });
      void qc.invalidateQueries({ queryKey: ["production-queue"] });
      void qc.invalidateQueries({ queryKey: ["trucks"] });
      void qc.invalidateQueries({ queryKey: ["drivers"] });
      if (res.data) onReassigned?.(res.data);
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to reassign transit mixer.");
    },
  });

  if (!trip) return null;

  const currentTruck = trip.tmNumber || trip.tmCode || "Unassigned";
  const currentDriver = trip.driverName || "Unassigned";

  // Filter out the currently assigned truck
  const availableTrucks = (trucksQuery.data || []).filter(
    (t) => t.id !== trip.tmId && (t.status === "AVAILABLE" || t.status === "ACTIVE"),
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTruckId) {
      toast.error("Please select a replacement transit mixer.");
      return;
    }
    reassignMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md text-xs">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <RefreshCw className="size-4.5" />
            </span>
            <div>
              <DialogTitle className="text-base font-bold">Swap / Reassign Transit Mixer</DialogTitle>
              <DialogDescription className="text-xs">
                Trip {trip.tripNumber} · Order {trip.poNumber} ({trip.customerName})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-lg bg-muted/60 p-3 border border-border space-y-1.5 my-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current TM:</span>
            <span className="font-semibold">{currentTruck}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current Driver:</span>
            <span>{currentDriver}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Trip Status / Qty:</span>
            <span>
              {trip.status} · {trip.quantity} cum ({trip.grade})
            </span>
          </div>
          {trip.batchSheetId && (
            <p className="text-[11px] text-amber-500 font-medium pt-1 border-t border-border/80">
              Note: This trip is already batched. The delivery challan will automatically update with the new truck number, and a Batch Sheet Revision will be logged for audit.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="space-y-1">
            <Label className="text-xs">Select Replacement Transit Mixer *</Label>
            <Select value={selectedTruckId} onValueChange={setSelectedTruckId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Choose available transit mixer..." />
              </SelectTrigger>
              <SelectContent>
                {availableTrucks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.tmNumber} (Capacity: {t.capacity} cum)
                  </SelectItem>
                ))}
                {availableTrucks.length === 0 && (
                  <SelectItem value="none" disabled>
                    No other trucks available right now
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Driver (Keep current or select new)</Label>
            <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select driver..." />
              </SelectTrigger>
              <SelectContent>
                {(driversQuery.data || []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} ({d.phone})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Reason for Reassignment *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Flat tyre / tyre puncture at plant">Flat tyre / tyre puncture at plant</SelectItem>
                <SelectItem value="Mechanical / engine breakdown">Mechanical / engine breakdown</SelectItem>
                <SelectItem value="Hydraulic drum rotation failure">Hydraulic drum rotation failure</SelectItem>
                <SelectItem value="Driver replacement / emergency">Driver replacement / emergency</SelectItem>
                <SelectItem value="Transshipment to larger capacity TM">Transshipment to larger capacity TM</SelectItem>
                <SelectItem value="Other">Other (custom reason)</SelectItem>
              </SelectContent>
            </Select>
            {reason === "Other" && (
              <Input
                placeholder="Enter specific breakdown or swap reason..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="h-8 text-xs mt-1"
                required
              />
            )}
          </div>

          <div className="flex items-center space-x-2 pt-1 border-t border-border">
            <Checkbox
              id="mark-breakdown"
              checked={markBreakdown}
              onCheckedChange={(checked) => setMarkBreakdown(Boolean(checked))}
            />
            <Label htmlFor="mark-breakdown" className="text-xs font-normal cursor-pointer">
              Mark old truck ({currentTruck}) as UNDER MAINTENANCE in fleet manager
            </Label>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={reassignMutation.isPending || !selectedTruckId}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            >
              {reassignMutation.isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Confirm Vehicle Swap
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
