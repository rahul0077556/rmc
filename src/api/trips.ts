import { request } from "./client";
import type { ApiResponse, Trip, TripStatus } from "@/types";

export interface TripRow extends Trip {
  poNumber: string;
  customerName: string;
  siteName: string;
  grade: string;
  tmCode: string;
  tmCapacity?: number;
  driverName: string;
  notes?: string;
}

export function decorateTrip(trip: any): TripRow {
  return {
    id: trip.id,
    tripNumber: trip.tripNumber || trip.id,
    poId: trip.poId,
    poNumber: trip.poNumber ?? trip.poId,
    customerName: trip.customerName || "—",
    siteName: trip.siteName || "—",
    grade: trip.grade || "—",
    sequence: trip.sequence || 1,
    quantity: trip.quantity ?? trip.quantity_cum ?? 0,
    tmId: trip.tmId || trip.truck_id,
    tmCode: trip.tmNumber || trip.tmCode || "Unassigned",
    tmCapacity: trip.tmCapacity,
    driverId: trip.driverId || trip.driver_id,
    driverName: trip.driverName || "Unassigned",
    plannedTime: trip.plannedTime || trip.planned_datetime || new Date().toISOString(),
    status: trip.status || "PLANNED",
    batchSheetId: trip.batchSheetId,
    challanNumber: trip.challanNumber,
    dispatchTime: trip.dispatchTime,
    deliveredAt: trip.deliveredAt,
    deliveredQuantity: trip.deliveredQuantity,
    receiverName: trip.receiverName,
    replacedByTripId: trip.replacedTripId || trip.replacedByTripId,
    notes: trip.notes || "",
    lastUpdate: trip.lastUpdate || trip.updated_at || new Date().toISOString(),
  };
}

export interface FleetSummary {
  byCapacity: {
    capacity: number;
    total: number;
    available: number;
    assigned: number;
    loaded: number;
    inTransit: number;
    maintenance: number;
  }[];
  drivers: {
    total: number;
    available: number;
    assigned: number;
    unavailable: number;
  };
}

export const tripsApi = {
  async list(filter?: { status?: TripStatus[]; poId?: string }): Promise<ApiResponse<TripRow[]>> {
    try {
      const params = new URLSearchParams();
      if (filter?.poId) params.append("poId", filter.poId);
      if (filter?.status && filter.status.length === 1 && filter.status[0]) params.append("status", filter.status[0]);

      const res = await request<any[]>({ url: `/trips?${params.toString()}`, method: "GET" });
      let rows = res.data || [];
      if (filter?.status && filter.status.length > 1) {
        rows = rows.filter((t: any) => filter.status!.includes(t.status));
      }
      return { data: rows.map(decorateTrip) };
    } catch {
      return { data: [] };
    }
  },

  async fleet(): Promise<ApiResponse<FleetSummary>> {
    const res = await request<FleetSummary>({ url: "/dashboard/truck-availability", method: "GET" });
    return {
      data: res.data || {
        byCapacity: [
          { capacity: 5, total: 2, available: 2, assigned: 0, loaded: 0, inTransit: 0, maintenance: 0 },
          { capacity: 7, total: 3, available: 2, assigned: 0, loaded: 0, inTransit: 0, maintenance: 1 },
          { capacity: 8, total: 3, available: 3, assigned: 0, loaded: 0, inTransit: 0, maintenance: 0 },
          { capacity: 9, total: 2, available: 2, assigned: 0, loaded: 0, inTransit: 0, maintenance: 0 },
          { capacity: 10, total: 2, available: 1, assigned: 0, loaded: 0, inTransit: 0, maintenance: 1 },
        ],
        drivers: { total: 10, available: 10, assigned: 0, unavailable: 0 },
      },
    };
  },

  async trucks(): Promise<ApiResponse<{ id: string; tmNumber: string; capacity: number; status: string }[]>> {
    const res = await request<any[]>({ url: "/trucks", method: "GET" });
    return { data: res.data || [] };
  },

  async drivers(): Promise<ApiResponse<{ id: string; name: string; phone: string; licenseNo: string; status: string }[]>> {
    const res = await request<any[]>({ url: "/drivers", method: "GET" });
    return { data: res.data || [] };
  },

  async get(id: string): Promise<ApiResponse<TripRow | null>> {
    const res = await request<any>({ url: `/trips/${id}`, method: "GET" });
    return { data: res.data ? decorateTrip(res.data) : null };
  },

  async plan(
    poId: string,
    plan: { quantity: number; tmId?: string; driverId?: string; plannedTime: string }[],
    _actor?: string,
  ): Promise<ApiResponse<TripRow[]>> {
    const results: TripRow[] = [];
    for (const item of plan) {
      const res = await request<any>({
        url: "/trips",
        method: "POST",
        data: {
          poId,
          quantity: item.quantity,
          tmId: item.tmId,
          driverId: item.driverId,
          plannedTime: item.plannedTime,
        },
      });
      if (res.data) {
        // Auto-send to production if truck & driver assigned
        if (item.tmId && item.driverId) {
          try {
            await request<any>({ url: `/trips/${res.data.id}/send-to-production`, method: "POST" });
          } catch {
            // keep planned state if not transitionable
          }
        }
        results.push(decorateTrip(res.data));
      }
    }
    return { data: results, message: "Trips planned in database" };
  },

  async setStatus(id: string, status: TripStatus, _actor?: string): Promise<ApiResponse<TripRow | null>> {
    let endpoint = "";
    if (status === "SENT_TO_PRODUCTION") {
      endpoint = `/trips/${id}/send-to-production`;
    } else if (status === "DISPATCHED") {
      endpoint = `/trips/${id}/release`;
    } else if (status === "IN_TRANSIT") {
      endpoint = `/trips/${id}/in-transit`;
    }

    if (endpoint) {
      const res = await request<any>({ url: endpoint, method: "POST" });
      return { data: res.data ? decorateTrip(res.data) : null, message: `Trip status updated to ${status}` };
    }

    const res = await this.get(id);
    return { data: res.data, message: "Trip status updated" };
  },

  async deliver(
    id: string,
    input: { deliveredQuantity: number; receiverName: string; deliveryTime: string },
    _actor?: string,
  ): Promise<ApiResponse<TripRow | null>> {
    const res = await request<any>({
      url: `/trips/${id}/deliver`,
      method: "POST",
      data: {
        deliveredQuantity: input.deliveredQuantity,
        receiverName: input.receiverName,
        deliveredAt: input.deliveryTime,
      },
    });
    return { data: res.data ? decorateTrip(res.data) : null, message: "Trip marked as delivered in database" };
  },

  async arriveSite(id: string, notes?: string): Promise<ApiResponse<TripRow | null>> {
    const res = await request<any>({
      url: `/trips/${id}/arrive`,
      method: "POST",
      data: { notes: notes || "TM reached site gate" },
    });
    return { data: res.data ? decorateTrip(res.data) : null, message: "TM arrival confirmed at site" };
  },

  async reportSiteIssue(id: string, issueType: string, details: string): Promise<ApiResponse<TripRow | null>> {
    const res = await request<any>({
      url: `/trips/${id}/report-issue`,
      method: "POST",
      data: { issueType, details },
    });
    return { data: res.data ? decorateTrip(res.data) : null, message: `Reported issue '${issueType}' to Dispatch` };
  },
};
