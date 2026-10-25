import { request } from "./client";
import type { ApiResponse, Customer, Site } from "@/types";

export interface CustomerRow extends Customer {
  activeOrders: number;
  sites: Site[];
}

function decorate(c: any): CustomerRow {
  return {
    id: c.id,
    name: c.name,
    contactPerson: c.contactPerson || c.contact_person || "",
    phone: c.phone || "",
    email: c.email || "",
    gstin: c.gstin || "",
    billingAddress: c.billingAddress || c.address || "",
    creditDays: c.creditDays ?? c.credit_days ?? 30,
    creditLimit: c.creditLimit ?? c.credit_limit ?? 0,
    activeOrders: c.activeOrders ?? 0,
    sites: (c.sites || []).map((s: any) => ({
      id: s.id,
      customerId: s.customerId || s.customer_id || c.id,
      name: s.name,
      address: s.address,
      contactPerson: s.contactPerson || s.contact_person || "",
      phone: s.phone || "",
      accessibilityNotes: s.accessibilityNotes || s.accessibility_notes || "",
    })),
  };
}

export const customersApi = {
  async list(): Promise<ApiResponse<CustomerRow[]>> {
    try {
      const res = await request<CustomerRow[]>({ url: "/customers", method: "GET" });
      return { data: (res.data || []).map(decorate) };
    } catch {
      return { data: [] };
    }
  },

  async get(id: string): Promise<ApiResponse<CustomerRow | null>> {
    const res = await request<CustomerRow>({ url: `/customers/${id}`, method: "GET" });
    return { data: res.data ? decorate(res.data) : null };
  },

  async sites(customerId: string): Promise<ApiResponse<Site[]>> {
    const res = await request<Site[]>({ url: `/sites?customerId=${customerId}`, method: "GET" });
    return {
      data: (res.data || []).map((s: any) => ({
        id: s.id,
        customerId: s.customerId || s.customer_id || customerId,
        name: s.name,
        address: s.address,
        contactPerson: s.contactPerson || s.contact_person || "",
        phone: s.phone || "",
        accessibilityNotes: s.accessibilityNotes || s.accessibility_notes || "",
      })),
    };
  },

  async create(input: Omit<Customer, "id">, _actor?: string): Promise<ApiResponse<CustomerRow>> {
    const res = await request<CustomerRow>({
      url: "/customers",
      method: "POST",
      data: {
        name: input.name,
        contactPerson: input.contactPerson,
        phone: input.phone,
        email: input.email,
        gstin: input.gstin,
        billingAddress: input.billingAddress,
        creditDays: input.creditDays,
        creditLimit: input.creditLimit,
      },
    });
    return { data: decorate(res.data), message: "Customer created successfully" };
  },

  async createSite(input: Omit<Site, "id">, _actor?: string): Promise<ApiResponse<Site>> {
    const res = await request<Site>({
      url: "/sites",
      method: "POST",
      data: {
        customerId: input.customerId,
        name: input.name,
        address: input.address,
        contactPerson: input.contactPerson,
        phone: input.phone,
        accessibilityNotes: input.accessibilityNotes,
      },
    });
    return { data: res.data, message: "Site created successfully" };
  },
};

