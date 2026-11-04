import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, User, Phone, Loader2, Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { customersApi } from "@/api/customers";
import type { Site } from "@/types";

interface AddSiteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName?: string;
  onSiteCreated?: (site: Site) => void;
}

export function AddSiteDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  onSiteCreated,
}: AddSiteDialogProps) {
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [accessibilityNotes, setAccessibilityNotes] = useState("");

  const createSiteMutation = useMutation({
    mutationFn: () =>
      customersApi.createSite({
        customerId,
        name: name.trim(),
        address: address.trim(),
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        accessibilityNotes: accessibilityNotes.trim() || "Standard TM access road verified",
      }),
    onSuccess: (res) => {
      toast.success(res.message || "Site added successfully!");
      void qc.invalidateQueries({ queryKey: ["customers"] });
      if (res.data && onSiteCreated) {
        onSiteCreated(res.data);
      }
      onOpenChange(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add site");
    },
  });

  const resetForm = () => {
    setName("");
    setAddress("");
    setContactPerson("");
    setPhone("");
    setAccessibilityNotes("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) {
      toast.error("Site name and address are required");
      return;
    }
    createSiteMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <MapPin className="size-5 text-primary" />
            Add Delivery Site
          </DialogTitle>
          <DialogDescription>
            {customerName ? `Add a new pour site for ${customerName}` : "Add a new delivery site"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="siteName">Site Name *</Label>
            <Input
              id="siteName"
              placeholder="e.g. IT Park Phase 2 / Tower A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="siteAddress">Site Address *</Label>
            <Textarea
              id="siteAddress"
              rows={2}
              placeholder="Plot No., Road, Landmark, Area"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contactPerson">Site Engineer / Incharge</Label>
              <Input
                id="contactPerson"
                placeholder="Name"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Contact Phone</Label>
              <Input
                id="phone"
                placeholder="10-digit mobile"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="accessibilityNotes">Access & Unloading Notes</Label>
            <Input
              id="accessibilityNotes"
              placeholder="e.g. 3-axle TM clearance, overnight entry only"
              value={accessibilityNotes}
              onChange={(e) => setAccessibilityNotes(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createSiteMutation.isPending}>
              {createSiteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Adding...
                </>
              ) : (
                <>
                  <Plus className="mr-2 size-4" /> Add Site
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
