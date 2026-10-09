import { respond } from "./client";
import { db, poById, recordAudit } from "@/lib/store";
import type { ApiResponse, Trip, TripStatus } from "@/types";

export interface TripRow extends Trip {
  poNumber: string;
  customerName: string;
  siteName: string;
  grade: string;
  tmCode: string;
  tmCapacity?: number;
  driverName: string;
}

export function decorateTrip(trip: Trip): TripRow {
  const po = db.purchaseOrders.find((p) => p.id === trip.poId);
  const tm = db.transitMixers.find((t) => t.id === trip.tmId);
  return {
    ...trip,
    poNumber: po?.poNumber ?? trip.poId,
    customerName: db.customers.find((c) => c.id === po?.customerId)?.name ?? "—",
    siteName: db.sites.find((s) => s.id === po?.siteId)?.name ?? "—",
    grade: po?.grade ?? "—",
    tmCode: tm?.code ?? "Unassigned",
    tmCapacity: tm?.capacity,
    driverName: db.drivers.find((d) => d.id === trip.driverId)?.name ?? "Unassigned",
  };
}

export const tripsApi = {
  list(filter?: { status?: TripStatus[]; poId?: string }): Promise<ApiResponse<TripRow[]>> {
    let rows = [...db.trips].sort((a, b) => b.plannedTime.localeCompare(a.plannedTime));
    if (filter?.poId) rows = rows.filter((t) => t.poId === filter.poId);
    if (filter?.status) rows = rows.filter((t) => filter.status!.includes(t.status));
    return respond(rows.map(decorateTrip));
  },

  get(id: string): Promise<ApiResponse<TripRow | null>> {
    const trip = db.trips.find((t) => t.id === id);
    return respond(trip ? decorateTrip(trip) : null);
  },

  plan(
    poId: string,
    plan: { quantity: number; tmId?: string; driverId?: string; plannedTime: string }[],
    actor: string,
  ): Promise<ApiResponse<TripRow[]>> {
    const po = poById(poId);
    if (!po) return respond([]);
    // replace existing un-batched trips for this PO
    for (let i = db.trips.length - 1; i >= 0; i--) {
      const t = db.trips[i]!;
      if (t.poId === poId && (t.status === "PLANNED" || t.status === "SENT_TO_PRODUCTION")) db.trips.splice(i, 1);
    }
    const created = plan.map((p, i) => {
      const trip: Trip = {
        id: `TRIP-2026-${String(db.trips.length + i + 1).padStart(5, "0")}`,
        tripNumber: `TRIP-2026-${String(db.trips.length + i + 1).padStart(5, "0")}`,
        poId,
        sequence: i + 1,
        quantity: p.quantity,
        tmId: p.tmId,
        driverId: p.driverId,
        plannedTime: p.plannedTime,
        status: "SENT_TO_PRODUCTION",
        lastUpdate: new Date().toISOString(),
      };
      return trip;
    });
    db.trips.push(...created);
    po.status = "IN_PROGRESS";
    recordAudit(actor, `planned ${created.length} trips for ${po.poNumber}`, po.poNumber);
    return respond(created.map(decorateTrip), "Trip assigned successfully");
  },

  setStatus(id: string, status: TripStatus, actor: string): Promise<ApiResponse<TripRow | null>> {
    const trip = db.trips.find((t) => t.id === id);
    if (trip) {
      trip.status = status;
      trip.lastUpdate = new Date().toISOString();
      if (status === "DISPATCHED" && !trip.challanNumber) {
        trip.challanNumber = `CH-2026-${String(db.trips.filter((t) => t.challanNumber).length + 1).padStart(5, "0")}`;
        trip.dispatchTime = new Date().toISOString();
      }
      recordAudit(actor, `moved ${trip.tripNumber} to ${status.replace(/_/g, " ")}`, trip.tripNumber);
    }
    return respond(trip ? decorateTrip(trip) : null, "Trip updated");
  },

  deliver(
    id: string,
    input: { deliveredQuantity: number; receiverName: string; deliveryTime: string },
    actor: string,
  ): Promise<ApiResponse<TripRow | null>> {
    const trip = db.trips.find((t) => t.id === id);
    if (trip) {
      trip.status = "DELIVERED";
      trip.deliveredQuantity = input.deliveredQuantity;
      trip.receiverName = input.receiverName;
      trip.deliveredAt = input.deliveryTime;
      trip.lastUpdate = new Date().toISOString();
      const po = poById(trip.poId);
      if (po) {
        po.deliveredQuantity = db.trips
          .filter((t) => t.poId === po.id && t.status === "DELIVERED")
          .reduce((s, t) => s + (t.deliveredQuantity ?? t.quantity), 0);
        po.status = po.deliveredQuantity >= po.quantity ? "COMPLETED" : "IN_PROGRESS";
      }
      recordAudit(actor, `recorded delivery for ${trip.tripNumber}`, trip.tripNumber);
    }
    return respond(trip ? decorateTrip(trip) : null, "Delivery recorded");
  },

  fleet(): Promise<
    ApiResponse<{
      byCapacity: { capacity: number; available: number; assigned: number; loaded: number; inTransit: number; maintenance: number }[];
      drivers: { available: number; assigned: number; unavailable: number };
    }>
  > {
    const capacities = [5, 7, 8, 9, 10];
    const byCapacity = capacities.map((capacity) => {
      const fleet = db.transitMixers.filter((t) => t.capacity === capacity);
      return {
        capacity,
        available: fleet.filter((t) => t.status === "AVAILABLE").length,
        assigned: fleet.filter((t) => t.status === "ASSIGNED").length,
        loaded: fleet.filter((t) => t.status === "LOADED").length,
        inTransit: fleet.filter((t) => t.status === "IN_TRANSIT").length,
        maintenance: fleet.filter((t) => t.status === "MAINTENANCE").length,
      };
    });
    return respond({
      byCapacity,
      drivers: {
        available: db.drivers.filter((d) => d.status === "AVAILABLE").length,
        assigned: db.drivers.filter((d) => d.status === "ASSIGNED").length,
        unavailable: db.drivers.filter((d) => d.status === "UNAVAILABLE").length,
      },
    });
  },
};
