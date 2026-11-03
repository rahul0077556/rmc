import { request } from "./client";
import { decorateTrip, type TripRow } from "./trips";
import type { ApiResponse, BatchSheet, Grade, MaterialLine } from "@/types";

export interface MaterialCheckRow {
  material: string;
  required: number;
  available: number;
  unit: string;
  sufficient: boolean;
  shortfall: number;
}

export interface ScadaBatchDocketData {
  plantName: string;
  plantCapacity: string;
  customerName: string;
  siteName: string;
  truckNumber: string;
  driverName: string;
  docketNumber: string;
  recipeName: string;
  grade: string;
  orderQtyCum: number;
  ticketQtyCum: number;
  withThisLoadCum: number;
  batchSizeCum: number;
  batchesCount: number;
  date: string;
  startTime: string;
  endTime: string;
  wcRatio: number;
  thVolume?: number;
  rSandKg: number;
  mSandKg: number;
  agg10mmKg: number;
  agg20mmKg: number;
  cementKg: number;
  flyashKg: number;
  waterL: number;
  admixtureKg: number;
  totalWeightKg: number;
}

export interface DailyConsumptionData {
  date: string;
  plantName: string;
  batchesCount: number;
  totalVolumeCum: number;
  totalWeightKg: number;
  totalWeightMt: number;
  materials: {
    material: string;
    category: string;
    unit: string;
    consumed: number;
    consumedMt?: number;
    consumedKl?: number;
    consumedKg?: number;
    consumedL?: number;
  }[];
  sheets: {
    id: string;
    docketNumber: string;
    batchNumber: string;
    recipeName: string;
    customer: string;
    site: string;
    truck: string;
    driver: string;
    volumeCum: number;
    batchedAt: string;
    cementKg: number;
    flyashKg: number;
    sandKg: number;
    aggKg: number;
    waterL: number;
    admixKg: number;
  }[];
}

export interface DprSheetData {
  date: string;
  summary: {
    totalPlannedCum: number;
    totalActualCum: number;
    varianceCum: number;
    achievementPct: number;
    plannedOrdersCount: number;
    dispatchedTripsCount: number;
  };
  plannedOrders: {
    id: string;
    poNumber: string;
    customerName: string;
    siteName: string;
    grade: string;
    plannedQty: number;
    pumpRequired: boolean;
    status: string;
  }[];
  actualTrips: {
    id: string;
    tripNumber: string;
    docketNumber: string;
    poNumber: string;
    customerName: string;
    siteName: string;
    grade: string;
    truckNumber: string;
    driverName: string;
    quantity: number;
    status: string;
    dispatchedAt: string;
    deliveredAt: string;
  }[];
  materials: any[];
}

export interface MprSheetData {
  month: string;
  plantName: string;
  summary: {
    targetCum: number;
    achievedCum: number;
    varianceCum: number;
    achievementPct: number;
    totalOrdersCount: number;
    totalTripsCount: number;
  };
  materials: {
    id: string;
    material: string;
    unit: string;
    openingStock: number;
    inward: number;
    consumed: number;
    theoretical: number;
    variance: number;
    closingStock: number;
    reorderLevel: number;
    status: string;
  }[];
  customers: {
    customerName: string;
    volumeCum: number;
    percentage: number;
  }[];
}

export const productionApi = {
  async queue(): Promise<ApiResponse<TripRow[]>> {
    try {
      const res = await request<any[]>({ url: "/production/queue", method: "GET" });
      const rows = res.data || [];
      return { data: rows.map(decorateTrip) };
    } catch {
      return { data: [] };
    }
  },

  async materialCheck(tripId: string): Promise<ApiResponse<MaterialCheckRow[]>> {
    try {
      const res = await request<any>({
        url: `/production/trips/${tripId}/check-materials`,
        method: "POST",
      });
      const data = res.data;
      if (!data) return { data: [] };

      // Case 1: Backend returns array of structured material check objects
      if (Array.isArray(data.requiredMaterials)) {
        const rows: MaterialCheckRow[] = data.requiredMaterials.map((rm: any) => {
          const sf = (data.shortfalls || []).find((s: any) => s.material === rm.material);
          const shortfall = rm.shortfall ?? (sf ? sf.shortfall : 0);
          return {
            material: rm.material,
            required: Number(rm.required),
            available: Number(rm.available ?? 0),
            unit: rm.unit || "kg",
            sufficient: rm.sufficient ?? (shortfall === 0),
            shortfall: Number(shortfall),
          };
        });
        return { data: rows };
      }

      // Case 2: Backend returns dictionary { [materialName]: requiredQty }
      if (data.requiredMaterials && typeof data.requiredMaterials === "object") {
        const shortfallsList = data.shortfalls || [];
        const rows: MaterialCheckRow[] = Object.entries(data.requiredMaterials).map(
          ([material, reqQty]: [string, any]) => {
            const sf = shortfallsList.find((s: any) => s.material === material);
            const shortfall = sf ? sf.shortfall : 0;
            const available = sf ? sf.available : Number(reqQty);
            return {
              material,
              required: Number(reqQty),
              available: Number(available),
              unit:
                sf?.unit ||
                (material.toLowerCase().includes("water") || material.toLowerCase().includes("admix")
                  ? "l"
                  : "kg"),
              sufficient: shortfall === 0,
              shortfall: Number(shortfall),
            };
          }
        );
        return { data: rows };
      }
    } catch {
      // Fallback
    }
    return { data: [] };
  },

  async startBatching(tripId: string, _actor?: string): Promise<ApiResponse<TripRow | null>> {
    const res = await request<any>({
      url: `/production/trips/${tripId}/start-batching`,
      method: "POST",
    });
    const trip = res.data?.trip || res.data;
    return { data: trip ? decorateTrip(trip) : null, message: "Batching started in plant" };
  },

  async confirmLoaded(tripId: string, _actor?: string): Promise<ApiResponse<BatchSheet | null>> {
    const res = await request<any>({
      url: `/production/trips/${tripId}/confirm-loaded`,
      method: "POST",
      data: {},
    });
    const sheet = res.data?.batchSheet || res.data;
    return { data: sheet, message: "Batch sheet generated and truck loaded" };
  },

  async batchSheet(id: string): Promise<ApiResponse<(BatchSheet & { trip: TripRow }) | null>> {
    const res = await request<any>({ url: `/batch-sheets/${id}`, method: "GET" });
    const data = res.data;
    if (!data) return { data: null };

    const trip = data.trip
      ? decorateTrip(data.trip)
      : decorateTrip({
          id: data.tripId,
          quantity: data.quantity,
          grade: data.grade,
        });
    const materials: MaterialLine[] = (data.materials || []).map((m: any) => ({
      material: m.material,
      unit: m.unit,
      theoretical: m.theoretical,
      actual: m.actual,
    }));

    const sheet: BatchSheet & { trip: TripRow } = {
      id: data.id,
      batchNumber: data.batchNumber || data.id,
      tripId: data.tripId,
      materials,
      batchTime: data.batchTime || new Date().toISOString(),
      operator: data.operator || "Auto AJAX Batcher",
      qcStatus: data.qcStatus || "PENDING",
      trip,
    };

    return { data: sheet };
  },

  async stock(): Promise<ApiResponse<any[]>> {
    const res = await request<any>({ url: "/store/inventory", method: "GET" });
    const raw = res.data?.materials || res.data || [];
    const stockList = Array.isArray(raw)
      ? raw.map((m: any) => ({
          material: m.name || m.material,
          available: m.available ?? m.stock ?? 0,
          unit: m.unit || "kg",
        }))
      : [];
    return { data: stockList };
  },

  async getSampleDocket(): Promise<ApiResponse<ScadaBatchDocketData>> {
    const res = await request<ScadaBatchDocketData>({
      url: "/production/batch-sheets/sample-docket",
      method: "GET",
    });
    return res;
  },

  async parseUploadedBatchSheet(payload: { text?: string; file?: File }): Promise<ApiResponse<ScadaBatchDocketData>> {
    if (payload.file) {
      const formData = new FormData();
      formData.append("file", payload.file);
      const res = await request<ScadaBatchDocketData>({
        url: "/production/batch-sheets/upload-parse",
        method: "POST",
        data: formData,
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res;
    }
    const res = await request<ScadaBatchDocketData>({
      url: "/production/batch-sheets/upload-parse",
      method: "POST",
      data: { text: payload.text || "" },
    });
    return res;
  },

  async confirmBatchSheetUpload(data: ScadaBatchDocketData): Promise<ApiResponse<any>> {
    const res = await request<any>({
      url: "/production/batch-sheets/confirm-upload",
      method: "POST",
      data,
    });
    return res;
  },

  async getDailyConsumption(date?: string): Promise<ApiResponse<DailyConsumptionData>> {
    const url = date ? `/production/daily-consumption?date=${date}` : "/production/daily-consumption";
    const res = await request<DailyConsumptionData>({ url, method: "GET" });
    return res;
  },

  async getDpr(date?: string): Promise<ApiResponse<DprSheetData>> {
    const url = date ? `/production/dpr?date=${date}` : "/production/dpr";
    const res = await request<DprSheetData>({ url, method: "GET" });
    return res;
  },

  async getMpr(month?: string): Promise<ApiResponse<MprSheetData>> {
    const url = month ? `/production/mpr?month=${month}` : "/production/mpr";
    const res = await request<MprSheetData>({ url, method: "GET" });
    return res;
  },
};
