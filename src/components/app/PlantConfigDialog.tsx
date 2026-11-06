import { useState, useEffect } from "react";
import { Building2, Save, Loader2, ShieldCheck, Cpu, MapPin, Phone, Mail, FileText, Gauge } from "lucide-react";
import { toast } from "sonner";
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
import { apiClient } from "@/api/client";
import { useAuth } from "@/auth/auth-context";

interface PlantConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlantConfigDialog({ open, onOpenChange }: PlantConfigDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    city: "",
    address: "",
    gstin: "",
    phone: "",
    email: "",
    capacity: "60 cum/hr",
    scadaType: "CRB-75 Plant Controller",
  });

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    apiClient
      .get("/plant")
      .then((res) => {
        const p = res.data?.data;
        if (p) {
          setFormData({
            name: p.name || user?.plant || "ROXXCON RMC NAGPUR",
            city: p.city || "Nagpur, Maharashtra",
            address: p.address || "",
            gstin: p.gstin || "27AAAPA0000A1Z5",
            phone: p.phone || "+91 98765 43210",
            email: p.email || user?.email || "plant@rmc.test",
            capacity: p.capacity || "60 cum/hr",
            scadaType: p.scadaType || p.scada_type || "CRB-75 Plant Controller",
          });
        }
      })
      .catch(() => {
        // Fallback to auth user state
        setFormData((prev) => ({
          ...prev,
          name: user?.plant || "ROXXCON RMC NAGPUR",
          email: user?.email || "plant@rmc.test",
        }));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Plant organization name is required");
      return;
    }

    setSaving(true);
    try {
      const res = await apiClient.put("/plant", {
        name: formData.name.trim(),
        city: formData.city.trim(),
        address: formData.address.trim(),
        gstin: formData.gstin.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        capacity: formData.capacity.trim(),
        scadaType: formData.scadaType.trim(),
      });

      // Update local storage session plant name if updated
      if (typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem("rmc.session");
          if (raw) {
            const parsed = JSON.parse(raw);
            parsed.plant = formData.name.trim();
            window.localStorage.setItem("rmc.session", JSON.stringify(parsed));
          }
        } catch {
          // ignore
        }
      }

      toast.success("Plant organization details updated successfully!");
      onOpenChange(false);
      // Small delayed refresh to update topbars and titles
      setTimeout(() => {
        window.location.reload();
      }, 400);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || "Failed to update plant configuration.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Building2 className="size-4" />
            </span>
            <div>
              <DialogTitle className="text-base font-bold">Plant Details & Configuration</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Manage operational facility identity, SCADA controller type, and compliance parameters.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Building2 className="size-3.5 text-primary" />
                <span>Plant / Organization Name</span>
              </Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Rahul Ready Mix Concrete"
                className="text-xs h-9"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-muted-foreground" />
                  <span>City / Operational Hub</span>
                </Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="e.g. Nagpur, Maharashtra"
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <FileText className="size-3.5 text-muted-foreground" />
                  <span>GSTIN Number</span>
                </Label>
                <Input
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                  placeholder="e.g. 27AAAPA1234F1Z1"
                  className="text-xs h-9 font-mono uppercase"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <MapPin className="size-3.5 text-muted-foreground" />
                <span>Campus / Facility Address</span>
              </Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="e.g. Plot 15, Industrial Area, Phase II"
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Phone className="size-3.5 text-muted-foreground" />
                  <span>Official Contact Phone</span>
                </Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 98220 12345"
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Mail className="size-3.5 text-muted-foreground" />
                  <span>Official Business Email</span>
                </Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contact@plant.com"
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Gauge className="size-3.5 text-primary" />
                  <span>Rated Batching Capacity</span>
                </Label>
                <Input
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  placeholder="e.g. 60 cum/hr, 90 cum/hr"
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Cpu className="size-3.5 text-primary" />
                  <span>SCADA Controller Type</span>
                </Label>
                <Input
                  value={formData.scadaType}
                  onChange={(e) => setFormData({ ...formData, scadaType: e.target.value })}
                  placeholder="e.g. CRB-75, Schwing, Liebherr"
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-start gap-2.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 shrink-0 text-primary mt-0.5" />
              <span>
                Changes take effect across live dispatch slips, gate challans, and customer GST invoices for this plant workspace.
              </span>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving} className="gap-1.5 font-bold">
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                <span>Save Configuration</span>
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

