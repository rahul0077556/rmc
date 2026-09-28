import { respond } from "./client";
import { db, recordAudit } from "@/lib/store";
import type { ApiResponse, Customer, Site } from "@/types";

export interface CustomerRow extends Customer {
  activeOrders: number;
  sites: Site[];
}

function decorate(c: Customer): CustomerRow {
  return {
    ...c,
    activeOrders: db.purchaseOrders.filter(
      (p) => p.customerId === c.id && ["SUBMITTED", "APPROVED", "IN_PROGRESS"].includes(p.status),
    ).length,
    sites: db.sites.filter((s) => s.customerId === c.id),
  };
}

export const customersApi = {
  list(): Promise<ApiResponse<CustomerRow[]>> {
    return respond(db.customers.map(decorate));
  },
  get(id: string): Promise<ApiResponse<CustomerRow | null>> {
    const c = db.customers.find((x) => x.id === id);
    return respond(c ? decorate(c) : null);
  },
  sites(customerId: string): Promise<ApiResponse<Site[]>> {
    return respond(db.sites.filter((s) => s.customerId === customerId));
  },
  create(input: Omit<Customer, "id">, actor: string): Promise<ApiResponse<CustomerRow>> {
    const customer: Customer = { ...input, id: `CUS-${String(db.customers.length + 1).padStart(2, "0")}` };
    db.customers.push(customer);
    recordAudit(actor, `created customer ${customer.name}`, customer.id);
    return respond(decorate(customer), "Customer created");
  },
  createSite(input: Omit<Site, "id">, actor: string): Promise<ApiResponse<Site>> {
    const site: Site = { ...input, id: `SITE-${db.sites.length + 1}` };
    db.sites.push(site);
    recordAudit(actor, `created site ${site.name}`, site.id);
    return respond(site, "Site created");
  },
};
