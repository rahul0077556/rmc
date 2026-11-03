import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, MapPin, User, Phone, Mail, FileText, CheckCircle2, Loader2, Plus } from "lucide-react";
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
import { customersApi, type CustomerRow } from "@/api/customers";

interface AddCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomerCreated?: (customer: CustomerRow) => void;
}

export function AddCustomerDialog({ open, onOpenChange, onCustomerCreated }: AddCustomerDialogProps) {
  const qc = useQueryClient();

  // Customer State
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstin, setGstin] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [creditDays, setCreditDays] = useState("30");
  const [creditLimit, setCreditLimit] = useState("1000000");

  // Initial Site State
  const [siteName, setSiteName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [siteContact, setSiteContact] = useState("");
  const [sitePhone, setSitePhone] = useState("");

  const createCustomerMutation = useMutation({
    mutationFn: () =>
      customersApi.create({
        name: name.trim(),
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        email: email.trim() || `accounts@${name.trim().toLowerCase().replace(/\s+/g, "")}.com`,
        gstin: gstin.trim().toUpperCase() || "27AAACS0000A1Z5",
        billingAddress: billingAddress.trim() || `${name} Office, Pune`,
        creditDays: Number(creditDays) || 30,
        creditLimit: Number(creditLimit) || 1000000,
        siteName: siteName.trim() || `${name.trim()} Site #1`,
        siteAddress: siteAddress.trim() || billingAddress.trim() || "Pune Concreting Site",
        siteContactPerson: siteContact.trim() || contactPerson.trim(),
        sitePhone: sitePhone.trim() || phone.trim(),
        accessibilityNotes: "TM 3-axle dumper access road verified",
      }),
    onSuccess: (res) => {
      toast.success(`Customer "${res.data.name}" and delivery site registered!`);
      void qc.invalidateQueries({ queryKey: ["customers"] });
      onCustomerCreated?.(res.data);
      onOpenChange(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to create customer. Please check required fields.");
    },
  });

  function resetForm() {
    setName("");
    setContactPerson("");
    setPhone("");
    setEmail("");
    setGstin("");
    setBillingAddress("");
    setCreditDays("30");
    setCreditLimit("1000000");
    setSiteName("");
    setSiteAddress("");
    setSiteContact("");
    setSitePhone("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter the customer / company name.");
      return;
    }
    if (!contactPerson.trim()) {
      toast.error("Please enter the primary contact person.");
      return;
    }
    if (!phone.trim()) {
      toast.error("Please enter a valid phone number.");
      return;
    }
    createCustomerMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-4.5" />
            </span>
            <div>
              <DialogTitle className="text-base font-bold">Register New Customer & Site</DialogTitle>
              <DialogDescription className="text-xs">
                Add contractor firm details, GST, commercial credit terms, and initial pouring site.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* SECTION 1: CUSTOMER COMPANY DETAILS */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary border-b border-border pb-1">
              <User className="size-3.5" />
              <span>Company & Commercial Details</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <Label htmlFor="cust-name" className="text-xs">Company / Customer Name *</Label>
                <Input
                  id="cust-name"
                  placeholder="e.g. Shapoorji Pallonji Ltd"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!siteName) setSiteName(`${e.target.value} Project Site`);
                  }}
                  required
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="cust-contact" className="text-xs">Contact Person *</Label>
                <Input
                  id="cust-contact"
                  placeholder="e.g. Rajesh Deshmukh"
                  value={contactPerson}
                  onChange={(e) => {
                    setContactPerson(e.target.value);
                    if (!siteContact) setSiteContact(e.target.value);
                  }}
                  required
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="cust-phone" className="text-xs">Phone Number *</Label>
                <Input
                  id="cust-phone"
                  placeholder="e.g. 9822012345"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (!sitePhone) setSitePhone(e.target.value);
                  }}
                  required
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="cust-email" className="text-xs">Email Address</Label>
                <Input
                  id="cust-email"
                  type="email"
                  placeholder="e.g. rajesh@shapoorji.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="cust-gstin" className="text-xs">GSTIN (15 Digits)</Label>
                <Input
                  id="cust-gstin"
                  placeholder="e.g. 27AAACS1234F1Z5"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  className="h-8 text-xs font-mono uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="cust-credit" className="text-xs">Credit Days</Label>
                  <Input
                    id="cust-credit"
                    type="number"
                    value={creditDays}
                    onChange={(e) => setCreditDays(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cust-limit" className="text-xs">Credit Limit (₹)</Label>
                  <Input
                    id="cust-limit"
                    type="number"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="cust-address" className="text-xs">Billing Office Address</Label>
                <Input
                  id="cust-address"
                  placeholder="e.g. Senapati Bapat Road, Shivaji Nagar, Pune 411016"
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: INITIAL DELIVERY SITE */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500 border-b border-border pb-1">
              <MapPin className="size-3.5" />
              <span>Initial Delivery Concreting Site</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <Label htmlFor="site-name" className="text-xs">Site / Project Name</Label>
                <Input
                  id="site-name"
                  placeholder="e.g. SP Infocity - Phase 3"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="site-contact" className="text-xs">Site In-Charge / Engineer</Label>
                <Input
                  id="site-contact"
                  placeholder="e.g. Amit Patil"
                  value={siteContact}
                  onChange={(e) => setSiteContact(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="site-phone" className="text-xs">Site Contact Phone</Label>
                <Input
                  id="site-phone"
                  placeholder="e.g. 9822099887"
                  value={sitePhone}
                  onChange={(e) => setSitePhone(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="site-address" className="text-xs">Site Exact Address / Landmark</Label>
                <Input
                  id="site-address"
                  placeholder="e.g. Survey 45, Fursungi IT Park, Hadapsar, Pune"
                  value={siteAddress}
                  onChange={(e) => setSiteAddress(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={createCustomerMutation.isPending} className="font-semibold">
              {createCustomerMutation.isPending ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 size-3.5" />
              )}
              Register Customer & Site
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

