import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { db } from "@/lib/store";

interface Hit {
  id: string;
  label: string;
  group: string;
  to: string;
}

export function CommandSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const hits = useMemo<Hit[]>(() => {
    const orders = db.purchaseOrders.slice(0, 40).map((p) => ({
      id: p.id,
      label: `${p.poNumber} · ${db.customers.find((c) => c.id === p.customerId)?.name ?? ""}`,
      group: "Purchase Orders",
      to: "/sales/orders",
    }));
    const tripHits = db.trips.slice(-40).map((t) => ({
      id: t.id,
      label: `${t.tripNumber} · ${t.tmId ?? "Unassigned"}`,
      group: "Trips",
      to: "/dispatcher",
    }));
    const batches = db.batchSheets.slice(-25).map((b) => ({
      id: b.id,
      label: `${b.batchNumber} · ${b.tripId}`,
      group: "Batch Sheets",
      to: "/production",
    }));
    const invoiceHits = db.invoices.slice(0, 25).map((i) => ({
      id: i.id,
      label: `${i.invoiceNumber} · ${db.customers.find((c) => c.id === i.customerId)?.name ?? ""}`,
      group: "Invoices",
      to: "/billing",
    }));
    const customerHits = db.customers.map((c) => ({
      id: c.id,
      label: c.name,
      group: "Customers",
      to: "/sales/customers",
    }));
    const fleet = db.transitMixers.map((t) => ({ id: t.id, label: `${t.code} · ${t.capacity} cum`, group: "Transit Mixers", to: "/dispatcher" }));
    const driverHits = db.drivers.map((d) => ({ id: d.id, label: d.name, group: "Drivers", to: "/dispatcher" }));
    return [...orders, ...tripHits, ...batches, ...invoiceHits, ...customerHits, ...fleet, ...driverHits];
  }, []);

  const groups = ["Purchase Orders", "Trips", "Batch Sheets", "Invoices", "Customers", "Transit Mixers", "Drivers"];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40"
      >
        <Search className="size-4" />
        <span className="truncate">Search PO, trip, batch sheet, challan, invoice…</span>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search across plant records…" />
        <CommandList>
          <CommandEmpty>No matching records.</CommandEmpty>
          {groups.map((group) => (
            <CommandGroup key={group} heading={group}>
              {hits
                .filter((h) => h.group === group)
                .slice(0, 6)
                .map((hit) => (
                  <CommandItem
                    key={`${group}-${hit.id}`}
                    value={hit.label}
                    onSelect={() => {
                      setOpen(false);
                      void navigate({ to: hit.to });
                    }}
                  >
                    {hit.label}
                  </CommandItem>
                ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
