import { getDb, saveDb } from "@/lib/store";
import { type ApiResponse } from "@/types";
import { delay } from "@/lib/utils";

export interface InventoryItem {
  id: string;
  material: string;
  category: "CEMENT" | "AGGREGATE" | "SAND" | "ADMIXTURE" | "WATER" | "SUPPLEMENTARY" | "CONSUMABLE" | "SPARE_PARTS" | "FUEL";
  currentStock: number;
  unit: string;
  capacity: number;
  reorderLevel: number;
  lastUpdated: string;
}

export interface WeighbridgeTicket {
  id: string;
  ticketNumber: string;
  type: "INWARD" | "OUTWARD";
  vehicleNumber: string;
  material: string;
  supplierOrCustomer: string;
  grossWeight: number; // kg
  tareWeight: number; // kg
  netWeight: number; // kg
  grossTime: string;
  tareTime: string;
  status: "PENDING_TARE" | "COMPLETED";
  variance?: number; // difference from challan
  challanWeight?: number;
  receivedRs?: number;
  wbName?: string;
  driverName?: string;
  watchmanName?: string;
  gatePassNo?: string;
}

export interface TransitMixerPayload {
  sNo: number;
  vehicleNo: string;
  vehicleType: string;
  make: "Ashok Leyland" | "Benz" | "TATA";
  location: "Mulkhed" | "Mhalunge";
  vehicleTyreDetails: "10 Tyres" | "12 Tyres";
  overLoadPass: "Yes" | "No";
  installedHandiCapacityCum: number;
  rtoGvwKg: number;
  tareWeightKg: number;
  weightOfWaterKg: number;
  newTareWeightKg: number;
  actualWeightForLoadingKg: number;
  payLoadCapacityRcGvwCum: number;
  supplyPayLoadCapacityOverloadPassCum: number;
}

export interface WeighbridgeSettings {
  plantName: string;
  vendorSoftwareName: string;
  vendorCompanyName: string;
  customerCare: string;
  wbName: string;
  comPort: string;
  autoCapture: boolean;
}

export interface DprRecord {
  id: string;
  date: string;
  totalBatches: number;
  totalCum: number;
  cementConsumedMt: number;
  flyAshConsumedMt: number;
  ggbsConsumedMt: number;
  sandConsumedMt: number;
  aggregateConsumedMt: number;
  waterConsumedKl: number;
  admixtureConsumedKg: number;
  dieselConsumedLtr: number;
}

export interface ExpenseRecord {
  id: string;
  category: "Diesel" | "Cement / Materials" | "Aggregate" | "Fly Ash / GGBS" | "Land Bills" | "Vehicle Maintenance";
  vendor: string;
  billNo: string;
  date: string;
  amount: number;
  status: "PAID" | "PENDING";
  description: string;
}

export interface AttendanceRecord {
  id: string;
  type: "DRIVER" | "STAFF";
  name: string;
  designationOrVehicle: string;
  shift: "Day" | "Night";
  tripsOrTasks: number;
  status: "PRESENT" | "ABSENT" | "ON_TRIP";
  syncSource: "UBITECH" | "Biometric" | "Manual";
  punchTime: string;
}

export const storeApi = {
  inventory: async (): Promise<ApiResponse<InventoryItem[]>> => {
    await delay(100);
    const db = getDb();
    if (!db.inventory) {
      db.inventory = fallbackInventory();
      saveDb(db);
    }
    return { data: db.inventory };
  },

  updateStock: async (materialId: string, addedStock: number): Promise<ApiResponse<InventoryItem>> => {
    await delay(100);
    const db = getDb();
    const inv = db.inventory ?? fallbackInventory();
    const item = inv.find((i) => i.id === materialId);
    if (!item) throw new Error("Material not found");
    item.currentStock = Math.max(0, item.currentStock + addedStock);
    item.lastUpdated = new Date().toISOString();
    db.inventory = inv;
    saveDb(db);
    return { data: item };
  },

  weighbridge: async (): Promise<ApiResponse<WeighbridgeTicket[]>> => {
    await delay(100);
    const db = getDb();
    if (!db.weighbridge) {
      db.weighbridge = fallbackTickets();
      saveDb(db);
    }
    return { data: db.weighbridge };
  },

  payloadDetails: async (): Promise<ApiResponse<TransitMixerPayload[]>> => {
    await delay(100);
    const db = getDb();
    if (!db.transitMixerPayloads) {
      db.transitMixerPayloads = fallbackPayloads();
      saveDb(db);
    }
    return { data: db.transitMixerPayloads };
  },

  settings: async (): Promise<ApiResponse<WeighbridgeSettings>> => {
    await delay(80);
    const db = getDb();
    if (!db.weighbridgeSettings || db.weighbridgeSettings.vendorCompanyName?.includes("Kunal") || db.weighbridgeSettings.vendorSoftwareName?.includes("StaticCCTV")) {
      db.weighbridgeSettings = fallbackSettings();
      saveDb(db);
    }
    return { data: db.weighbridgeSettings };
  },

  updateSettings: async (settings: WeighbridgeSettings): Promise<ApiResponse<WeighbridgeSettings>> => {
    await delay(100);
    const db = getDb();
    db.weighbridgeSettings = settings;
    saveDb(db);
    return { data: settings };
  },

  dprReports: async (): Promise<ApiResponse<DprRecord[]>> => {
    await delay(100);
    const db = getDb();
    if (!db.dprRecords) {
      db.dprRecords = fallbackDprRecords();
      saveDb(db);
    }
    return { data: db.dprRecords };
  },

  expenses: async (): Promise<ApiResponse<ExpenseRecord[]>> => {
    await delay(100);
    const db = getDb();
    if (!db.storeExpenses) {
      db.storeExpenses = fallbackExpenses();
      saveDb(db);
    }
    return { data: db.storeExpenses };
  },

  attendance: async (): Promise<ApiResponse<AttendanceRecord[]>> => {
    await delay(100);
    const db = getDb();
    if (!db.storeAttendance) {
      db.storeAttendance = fallbackAttendance();
      saveDb(db);
    }
    return { data: db.storeAttendance };
  },

  createTicket: async (
    data: Omit<WeighbridgeTicket, "id" | "ticketNumber" | "netWeight" | "status" | "variance" | "tareTime">
  ): Promise<ApiResponse<WeighbridgeTicket>> => {
    await delay(100);
    const db = getDb();
    const tickets = db.weighbridge ?? fallbackTickets();
    const newTicket: WeighbridgeTicket = {
      ...data,
      id: "WB" + Date.now(),
      ticketNumber: "TK" + (tickets.length + 65508),
      gatePassNo: `GP-${Math.floor(1000 + Math.random() * 9000)}`,
      netWeight: 0,
      tareTime: "",
      status: "PENDING_TARE",
      wbName: data.wbName || "Weigh Bridge #1",
      watchmanName: data.watchmanName || "Ganesh Shinde (Gate Security)",
    };
    db.weighbridge = [newTicket, ...tickets];
    saveDb(db);
    return { data: newTicket };
  },

  saveWeighbridgeEntry: async (entry: {
    wbName: string;
    ticketNumber: string;
    type: "INWARD" | "OUTWARD";
    vehicleNumber: string;
    partyName: string;
    product: string;
    grossWeight: number;
    tareWeight: number;
    grossDate: string;
    tareDate: string;
    receivedRs?: number;
    driverName?: string;
    watchmanName?: string;
  }): Promise<ApiResponse<{ ticket: WeighbridgeTicket; updatedStock: InventoryItem | null }>> => {
    await delay(150);
    const db = getDb();
    const tickets = db.weighbridge ?? fallbackTickets();
    const netWeight = Math.max(0, entry.grossWeight - entry.tareWeight);

    const ticket: WeighbridgeTicket = {
      id: "WB" + Date.now(),
      ticketNumber: entry.ticketNumber || `TK${tickets.length + 65508}`,
      gatePassNo: `GP-${Math.floor(1000 + Math.random() * 9000)}`,
      type: entry.type,
      vehicleNumber: entry.vehicleNumber,
      material: entry.product,
      supplierOrCustomer: entry.partyName,
      grossWeight: entry.grossWeight,
      tareWeight: entry.tareWeight,
      netWeight,
      grossTime: entry.grossDate || new Date().toISOString(),
      tareTime: entry.tareDate || new Date().toISOString(),
      status: "COMPLETED",
      receivedRs: entry.receivedRs,
      wbName: entry.wbName || "Weigh Bridge #1",
      driverName: entry.driverName || "Assigned Driver",
      watchmanName: entry.watchmanName || "Ganesh Shinde (Gate Security)",
    };

    db.weighbridge = [ticket, ...tickets];

    // AUTOMATIC INVENTORY STOCK UPDATE
    const inv = db.inventory ?? fallbackInventory();
    let updatedItem: InventoryItem | null = null;

    const matched = inv.find((i) =>
      i.material.toLowerCase().includes(entry.product.toLowerCase()) ||
      entry.product.toLowerCase().includes(i.material.toLowerCase())
    );

    if (matched && netWeight > 0) {
      const deltaTons = ["MT", "Tons"].includes(matched.unit) ? netWeight / 1000 : netWeight;
      if (entry.type === "INWARD") {
        matched.currentStock += deltaTons;
      } else {
        matched.currentStock = Math.max(0, matched.currentStock - deltaTons);
      }
      matched.lastUpdated = new Date().toISOString();
      updatedItem = matched;
      db.inventory = inv;
    }

    saveDb(db);
    return { data: { ticket, updatedStock: updatedItem } };
  },

  completeTicket: async (
    id: string,
    tareWeight: number
  ): Promise<ApiResponse<WeighbridgeTicket>> => {
    await delay(100);
    const db = getDb();
    const tickets = db.weighbridge ?? fallbackTickets();
    const idx = tickets.findIndex((t) => t.id === id);
    if (idx === -1 || !tickets[idx]) throw new Error("Ticket not found");

    const t = tickets[idx]!;
    t.tareWeight = tareWeight;
    t.netWeight = Math.max(0, t.grossWeight - tareWeight);
    t.tareTime = new Date().toISOString();
    t.status = "COMPLETED";

    if (t.challanWeight) {
      t.variance = t.netWeight - t.challanWeight;
    }

    // Update inventory if inward
    if (t.type === "INWARD" && t.netWeight > 0) {
      const inv = db.inventory ?? fallbackInventory();
      const item = inv.find((i) =>
        i.material.toLowerCase().includes(t.material.toLowerCase()) ||
        t.material.toLowerCase().includes(i.material.toLowerCase())
      );
      if (item) {
        const added = ["MT", "Tons"].includes(item.unit) ? t.netWeight / 1000 : t.netWeight;
        item.currentStock += added;
        item.lastUpdated = new Date().toISOString();
        db.inventory = inv;
      }
    }

    tickets[idx] = t;
    db.weighbridge = tickets;
    saveDb(db);
    return { data: t };
  },
};

export function fallbackSettings(): WeighbridgeSettings {
  return {
    plantName: "Sai ReadyMix Concrete",
    vendorSoftwareName: "Sai RMC Weighbridge Console v2.0",
    vendorCompanyName: "Sai ReadyMix Concrete - Plant Automation",
    customerCare: "+91 80877 09501",
    wbName: "Weigh Bridge #1",
    comPort: "COM3 (Serial 9600-8-N-1)",
    autoCapture: true,
  };
}

export function fallbackInventory(): InventoryItem[] {
  return [
    { id: "1", material: "OPC 53 Cement", category: "CEMENT", currentStock: 140, unit: "MT", capacity: 200, reorderLevel: 50, lastUpdated: new Date().toISOString() },
    { id: "2", material: "PPC Cement", category: "CEMENT", currentStock: 45, unit: "MT", capacity: 100, reorderLevel: 20, lastUpdated: new Date().toISOString() },
    { id: "3", material: "Fly Ash (Class F)", category: "SUPPLEMENTARY", currentStock: 110, unit: "MT", capacity: 180, reorderLevel: 40, lastUpdated: new Date().toISOString() },
    { id: "4", material: "GGBS (Slag)", category: "SUPPLEMENTARY", currentStock: 85, unit: "MT", capacity: 150, reorderLevel: 30, lastUpdated: new Date().toISOString() },
    { id: "5", material: "Crushed Sand (M-Sand)", category: "SAND", currentStock: 850, unit: "MT", capacity: 1500, reorderLevel: 300, lastUpdated: new Date().toISOString() },
    { id: "6", material: "Natural River Sand", category: "SAND", currentStock: 210, unit: "MT", capacity: 500, reorderLevel: 100, lastUpdated: new Date().toISOString() },
    { id: "7", material: "Aggregate 10mm", category: "AGGREGATE", currentStock: 420, unit: "MT", capacity: 1000, reorderLevel: 200, lastUpdated: new Date().toISOString() },
    { id: "8", material: "Aggregate 20mm", category: "AGGREGATE", currentStock: 580, unit: "MT", capacity: 1200, reorderLevel: 200, lastUpdated: new Date().toISOString() },
    { id: "9", material: "Aggregate 40mm", category: "AGGREGATE", currentStock: 160, unit: "MT", capacity: 500, reorderLevel: 80, lastUpdated: new Date().toISOString() },
    { id: "10", material: "Admixture PC (Polycarboxylate)", category: "ADMIXTURE", currentStock: 2500, unit: "Ltr", capacity: 5000, reorderLevel: 1000, lastUpdated: new Date().toISOString() },
    { id: "11", material: "Water (Industrial Tank)", category: "WATER", currentStock: 45000, unit: "Ltr", capacity: 80000, reorderLevel: 15000, lastUpdated: new Date().toISOString() },
    { id: "12", material: "Diesel (HSD)", category: "FUEL", currentStock: 4200, unit: "Ltr", capacity: 8000, reorderLevel: 1500, lastUpdated: new Date().toISOString() },
    { id: "13", material: "Grease / Industrial Lubricants", category: "CONSUMABLE", currentStock: 350, unit: "Kg", capacity: 600, reorderLevel: 100, lastUpdated: new Date().toISOString() },
    { id: "14", material: "Transit Mixer Handi Blades & Spares", category: "SPARE_PARTS", currentStock: 24, unit: "Sets", capacity: 50, reorderLevel: 8, lastUpdated: new Date().toISOString() },
  ];
}

export function fallbackTickets(): WeighbridgeTicket[] {
  return [
    {
      id: "WB1001",
      ticketNumber: "TK65506",
      gatePassNo: "GP-4819",
      type: "INWARD",
      vehicleNumber: "MH 14 GU 3506",
      material: "Crushed Sand (M-Sand)",
      supplierOrCustomer: "Shree Minerals Ltd.",
      grossWeight: 45200,
      tareWeight: 12100,
      netWeight: 33100,
      grossTime: new Date(Date.now() - 7200000).toISOString(),
      tareTime: new Date(Date.now() - 6600000).toISOString(),
      status: "COMPLETED",
      challanWeight: 33000,
      variance: 100,
      receivedRs: 48500,
      wbName: "Weigh Bridge #1",
      driverName: "Sanjay Shinde",
      watchmanName: "Ganesh Shinde",
    },
    {
      id: "WB1002",
      ticketNumber: "TK65507",
      gatePassNo: "GP-4820",
      type: "INWARD",
      vehicleNumber: "MH 14 HG 3501",
      material: "OPC 53 Cement",
      supplierOrCustomer: "UltraTech Cement Ltd.",
      grossWeight: 47900,
      tareWeight: 12900,
      netWeight: 35000,
      grossTime: new Date(Date.now() - 3600000).toISOString(),
      tareTime: new Date(Date.now() - 3000000).toISOString(),
      status: "COMPLETED",
      challanWeight: 35000,
      variance: 0,
      receivedRs: 182000,
      wbName: "Weigh Bridge #1",
      driverName: "Rahul Jadhav",
      watchmanName: "Ganesh Shinde",
    },
    {
      id: "WB1003",
      ticketNumber: "TK65508",
      gatePassNo: "GP-4821",
      type: "OUTWARD",
      vehicleNumber: "MH 14 KA 3514",
      material: "Concrete M25",
      supplierOrCustomer: "Lodha Developers - Pune Site",
      grossWeight: 27500,
      tareWeight: 12500,
      netWeight: 15000,
      grossTime: new Date(Date.now() - 1200000).toISOString(),
      tareTime: new Date(Date.now() - 600000).toISOString(),
      status: "COMPLETED",
      receivedRs: 67500,
      wbName: "Weigh Bridge #1",
      driverName: "Kailash Patil",
      watchmanName: "Ganesh Shinde",
    },
  ];
}

export function fallbackDprRecords(): DprRecord[] {
  return [
    {
      id: "DPR-01",
      date: new Date().toISOString().slice(0, 10),
      totalBatches: 38,
      totalCum: 242,
      cementConsumedMt: 84.7,
      flyAshConsumedMt: 22.4,
      ggbsConsumedMt: 14.8,
      sandConsumedMt: 198.5,
      aggregateConsumedMt: 295.2,
      waterConsumedKl: 38.6,
      admixtureConsumedKg: 726,
      dieselConsumedLtr: 410,
    },
    {
      id: "DPR-02",
      date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      totalBatches: 42,
      totalCum: 268,
      cementConsumedMt: 93.8,
      flyAshConsumedMt: 25.1,
      ggbsConsumedMt: 16.2,
      sandConsumedMt: 219.8,
      aggregateConsumedMt: 326.9,
      waterConsumedKl: 42.8,
      admixtureConsumedKg: 804,
      dieselConsumedLtr: 450,
    },
    {
      id: "DPR-03",
      date: new Date(Date.now() - 172800000).toISOString().slice(0, 10),
      totalBatches: 35,
      totalCum: 224,
      cementConsumedMt: 78.4,
      flyAshConsumedMt: 20.9,
      ggbsConsumedMt: 13.5,
      sandConsumedMt: 183.7,
      aggregateConsumedMt: 273.2,
      waterConsumedKl: 35.8,
      admixtureConsumedKg: 672,
      dieselConsumedLtr: 385,
    },
  ];
}

export function fallbackExpenses(): ExpenseRecord[] {
  return [
    {
      id: "EXP-101",
      category: "Diesel",
      vendor: "Indian Oil Petrol Pump - Mulkhed",
      billNo: "IOCL-98412",
      date: new Date().toISOString().slice(0, 10),
      amount: 42500,
      status: "PAID",
      description: "450 Ltr High Speed Diesel for Transit Mixers & Batching Plant Generator",
    },
    {
      id: "EXP-102",
      category: "Cement / Materials",
      vendor: "UltraTech Cement Ltd.",
      billNo: "INV-UTC-7719",
      date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      amount: 285000,
      status: "PENDING",
      description: "60 MT OPC 53 Bulk Cement Supply",
    },
    {
      id: "EXP-103",
      category: "Aggregate",
      vendor: "Venkatesh Stone Crushers",
      billNo: "VSC-1029",
      date: new Date(Date.now() - 172800000).toISOString().slice(0, 10),
      amount: 142000,
      status: "PAID",
      description: "120 MT 10mm & 20mm Blue Metal Aggregates",
    },
    {
      id: "EXP-104",
      category: "Fly Ash / GGBS",
      vendor: "Dirk India / Pozzocrete",
      billNo: "DI-5502",
      date: new Date(Date.now() - 259200000).toISOString().slice(0, 10),
      amount: 68000,
      status: "PAID",
      description: "35 MT Classified Fly Ash (Class F)",
    },
    {
      id: "EXP-105",
      category: "Vehicle Maintenance",
      vendor: "Mahalaxmi Auto Spares & Garage",
      billNo: "MAG-882",
      date: new Date(Date.now() - 345600000).toISOString().slice(0, 10),
      amount: 32000,
      status: "PAID",
      description: "TM MH 14 KA 3514 Hydraulic Pump Hose Replacement & Drum Rollers Greasing",
    },
    {
      id: "EXP-106",
      category: "Land Bills",
      vendor: "MSEDCL (Maharashtra State Electricity)",
      billNo: "MSE-918231",
      date: new Date(Date.now() - 432000000).toISOString().slice(0, 10),
      amount: 88400,
      status: "PAID",
      description: "Mulkhed Plant HT Industrial Power Bill for Last Month",
    },
  ];
}

export function fallbackAttendance(): AttendanceRecord[] {
  return [
    { id: "ATT-01", type: "DRIVER", name: "Sanjay Shinde", designationOrVehicle: "TM: MH 14 GU 3506", shift: "Day", tripsOrTasks: 4, status: "PRESENT", syncSource: "UBITECH", punchTime: "07:45 AM" },
    { id: "ATT-02", type: "DRIVER", name: "Rahul Jadhav", designationOrVehicle: "TM: MH 14 HG 3501", shift: "Day", tripsOrTasks: 5, status: "ON_TRIP", syncSource: "UBITECH", punchTime: "07:50 AM" },
    { id: "ATT-03", type: "DRIVER", name: "Kailash Patil", designationOrVehicle: "TM: MH 14 KA 3514", shift: "Day", tripsOrTasks: 3, status: "ON_TRIP", syncSource: "UBITECH", punchTime: "08:00 AM" },
    { id: "ATT-04", type: "DRIVER", name: "Amol More", designationOrVehicle: "TM: MH 14 LB 3529", shift: "Day", tripsOrTasks: 4, status: "PRESENT", syncSource: "UBITECH", punchTime: "08:05 AM" },
    { id: "ATT-05", type: "DRIVER", name: "Dnyaneshwar Gore", designationOrVehicle: "TM: MH 14 MH 3536", shift: "Night", tripsOrTasks: 0, status: "PRESENT", syncSource: "UBITECH", punchTime: "07:30 PM" },
    { id: "ATT-06", type: "STAFF", name: "Rajesh Gupta", designationOrVehicle: "Storekeeper / Materials Manager", shift: "Day", tripsOrTasks: 12, status: "PRESENT", syncSource: "UBITECH", punchTime: "07:30 AM" },
    { id: "ATT-07", type: "STAFF", name: "Suresh Chavan", designationOrVehicle: "Batching Plant Operator", shift: "Day", tripsOrTasks: 38, status: "PRESENT", syncSource: "UBITECH", punchTime: "07:40 AM" },
    { id: "ATT-08", type: "STAFF", name: "Ganesh Shinde", designationOrVehicle: "Weighbridge Watchman & Security", shift: "Day", tripsOrTasks: 18, status: "PRESENT", syncSource: "UBITECH", punchTime: "07:00 AM" },
    { id: "ATT-09", type: "STAFF", name: "Mahesh Kadam", designationOrVehicle: "Loader Operator (Aggregates)", shift: "Day", tripsOrTasks: 22, status: "PRESENT", syncSource: "UBITECH", punchTime: "07:55 AM" },
  ];
}

export function fallbackPayloads(): TransitMixerPayload[] {
  return [
    {
      sNo: 7,
      vehicleNo: "MH 14 GU 3506",
      vehicleType: "TM",
      make: "Ashok Leyland",
      location: "Mulkhed",
      vehicleTyreDetails: "10 Tyres",
      overLoadPass: "No",
      installedHandiCapacityCum: 6,
      rtoGvwKg: 28000,
      tareWeightKg: 11600,
      weightOfWaterKg: 500,
      newTareWeightKg: 12100,
      actualWeightForLoadingKg: 15900,
      payLoadCapacityRcGvwCum: 6,
      supplyPayLoadCapacityOverloadPassCum: 6,
    },
    {
      sNo: 8,
      vehicleNo: "MH 14 GU 3507",
      vehicleType: "TM",
      make: "Ashok Leyland",
      location: "Mulkhed",
      vehicleTyreDetails: "10 Tyres",
      overLoadPass: "No",
      installedHandiCapacityCum: 6,
      rtoGvwKg: 28000,
      tareWeightKg: 11600,
      weightOfWaterKg: 500,
      newTareWeightKg: 12100,
      actualWeightForLoadingKg: 15900,
      payLoadCapacityRcGvwCum: 6,
      supplyPayLoadCapacityOverloadPassCum: 6,
    },
    {
      sNo: 9,
      vehicleNo: "MH 14 HG 3501",
      vehicleType: "TM",
      make: "Benz",
      location: "Mulkhed",
      vehicleTyreDetails: "10 Tyres",
      overLoadPass: "Yes",
      installedHandiCapacityCum: 8,
      rtoGvwKg: 28000,
      tareWeightKg: 12400,
      weightOfWaterKg: 500,
      newTareWeightKg: 12900,
      actualWeightForLoadingKg: 15100,
      payLoadCapacityRcGvwCum: 6,
      supplyPayLoadCapacityOverloadPassCum: 8,
    },
    {
      sNo: 10,
      vehicleNo: "MH 14 HG 3508",
      vehicleType: "TM",
      make: "Benz",
      location: "Mulkhed",
      vehicleTyreDetails: "10 Tyres",
      overLoadPass: "Yes",
      installedHandiCapacityCum: 8,
      rtoGvwKg: 28000,
      tareWeightKg: 12400,
      weightOfWaterKg: 500,
      newTareWeightKg: 12900,
      actualWeightForLoadingKg: 15100,
      payLoadCapacityRcGvwCum: 6,
      supplyPayLoadCapacityOverloadPassCum: 8,
    },
    {
      sNo: 12,
      vehicleNo: "MH 14 HG 3511",
      vehicleType: "TM",
      make: "Benz",
      location: "Mulkhed",
      vehicleTyreDetails: "12 Tyres",
      overLoadPass: "Yes",
      installedHandiCapacityCum: 10,
      rtoGvwKg: 35000,
      tareWeightKg: 14400,
      weightOfWaterKg: 500,
      newTareWeightKg: 14900,
      actualWeightForLoadingKg: 20100,
      payLoadCapacityRcGvwCum: 8,
      supplyPayLoadCapacityOverloadPassCum: 10,
    },
    {
      sNo: 15,
      vehicleNo: "MH 14 KA 3514",
      vehicleType: "TM",
      make: "TATA",
      location: "Mhalunge",
      vehicleTyreDetails: "10 Tyres",
      overLoadPass: "Yes",
      installedHandiCapacityCum: 7,
      rtoGvwKg: 28000,
      tareWeightKg: 12000,
      weightOfWaterKg: 500,
      newTareWeightKg: 12500,
      actualWeightForLoadingKg: 15500,
      payLoadCapacityRcGvwCum: 6,
      supplyPayLoadCapacityOverloadPassCum: 7,
    },
    {
      sNo: 17,
      vehicleNo: "MH 14 KA 3516",
      vehicleType: "TM",
      make: "TATA",
      location: "Mulkhed",
      vehicleTyreDetails: "10 Tyres",
      overLoadPass: "Yes",
      installedHandiCapacityCum: 9,
      rtoGvwKg: 28000,
      tareWeightKg: 14580,
      weightOfWaterKg: 500,
      newTareWeightKg: 15080,
      actualWeightForLoadingKg: 12920,
      payLoadCapacityRcGvwCum: 5,
      supplyPayLoadCapacityOverloadPassCum: 9,
    },
    {
      sNo: 19,
      vehicleNo: "MH 14 KA 3518",
      vehicleType: "TM",
      make: "TATA",
      location: "Mulkhed",
      vehicleTyreDetails: "10 Tyres",
      overLoadPass: "Yes",
      installedHandiCapacityCum: 9,
      rtoGvwKg: 28000,
      tareWeightKg: 14580,
      weightOfWaterKg: 500,
      newTareWeightKg: 15080,
      actualWeightForLoadingKg: 12920,
      payLoadCapacityRcGvwCum: 5,
      supplyPayLoadCapacityOverloadPassCum: 9,
    },
    {
      sNo: 25,
      vehicleNo: "MH 14 LB 3529",
      vehicleType: "TM",
      make: "TATA",
      location: "Mhalunge",
      vehicleTyreDetails: "10 Tyres",
      overLoadPass: "Yes",
      installedHandiCapacityCum: 7,
      rtoGvwKg: 28000,
      tareWeightKg: 12000,
      weightOfWaterKg: 500,
      newTareWeightKg: 12500,
      actualWeightForLoadingKg: 15500,
      payLoadCapacityRcGvwCum: 6,
      supplyPayLoadCapacityOverloadPassCum: 7,
    },
    {
      sNo: 27,
      vehicleNo: "MH 14 LB 3531",
      vehicleType: "TM",
      make: "TATA",
      location: "Mhalunge",
      vehicleTyreDetails: "10 Tyres",
      overLoadPass: "Yes",
      installedHandiCapacityCum: 7,
      rtoGvwKg: 28000,
      tareWeightKg: 12000,
      weightOfWaterKg: 500,
      newTareWeightKg: 12500,
      actualWeightForLoadingKg: 15500,
      payLoadCapacityRcGvwCum: 6,
      supplyPayLoadCapacityOverloadPassCum: 7,
    },
    {
      sNo: 28,
      vehicleNo: "MH 14 LB 3532",
      vehicleType: "TM",
      make: "TATA",
      location: "Mhalunge",
      vehicleTyreDetails: "10 Tyres",
      overLoadPass: "Yes",
      installedHandiCapacityCum: 7,
      rtoGvwKg: 28000,
      tareWeightKg: 12000,
      weightOfWaterKg: 500,
      newTareWeightKg: 12500,
      actualWeightForLoadingKg: 15500,
      payLoadCapacityRcGvwCum: 6,
      supplyPayLoadCapacityOverloadPassCum: 7,
    },
    {
      sNo: 29,
      vehicleNo: "MH 14 LB 3533",
      vehicleType: "TM",
      make: "TATA",
      location: "Mhalunge",
      vehicleTyreDetails: "10 Tyres",
      overLoadPass: "Yes",
      installedHandiCapacityCum: 7,
      rtoGvwKg: 28000,
      tareWeightKg: 12000,
      weightOfWaterKg: 500,
      newTareWeightKg: 12500,
      actualWeightForLoadingKg: 15500,
      payLoadCapacityRcGvwCum: 6,
      supplyPayLoadCapacityOverloadPassCum: 7,
    },
    {
      sNo: 31,
      vehicleNo: "MH 14 LB 3537",
      vehicleType: "TM",
      make: "TATA",
      location: "Mulkhed",
      vehicleTyreDetails: "10 Tyres",
      overLoadPass: "Yes",
      installedHandiCapacityCum: 7,
      rtoGvwKg: 28000,
      tareWeightKg: 12000,
      weightOfWaterKg: 500,
      newTareWeightKg: 12500,
      actualWeightForLoadingKg: 15500,
      payLoadCapacityRcGvwCum: 6,
      supplyPayLoadCapacityOverloadPassCum: 7,
    },
    {
      sNo: 34,
      vehicleNo: "MH 14 MH 3536",
      vehicleType: "TM",
      make: "Ashok Leyland",
      location: "Mulkhed",
      vehicleTyreDetails: "10 Tyres",
      overLoadPass: "No",
      installedHandiCapacityCum: 6,
      rtoGvwKg: 25000,
      tareWeightKg: 11610,
      weightOfWaterKg: 500,
      newTareWeightKg: 12110,
      actualWeightForLoadingKg: 12890,
      payLoadCapacityRcGvwCum: 5,
      supplyPayLoadCapacityOverloadPassCum: 5,
    },
    {
      sNo: 38,
      vehicleNo: "MH 12 QW 2092",
      vehicleType: "TM",
      make: "TATA",
      location: "Mulkhed",
      vehicleTyreDetails: "10 Tyres",
      overLoadPass: "No",
      installedHandiCapacityCum: 6,
      rtoGvwKg: 25000,
      tareWeightKg: 11610,
      weightOfWaterKg: 500,
      newTareWeightKg: 12110,
      actualWeightForLoadingKg: 12890,
      payLoadCapacityRcGvwCum: 5,
      supplyPayLoadCapacityOverloadPassCum: 5,
    },
    {
      sNo: 40,
      vehicleNo: "MH 12 QW 7664",
      vehicleType: "TM",
      make: "TATA",
      location: "Mulkhed",
      vehicleTyreDetails: "10 Tyres",
      overLoadPass: "No",
      installedHandiCapacityCum: 6,
      rtoGvwKg: 25000,
      tareWeightKg: 11610,
      weightOfWaterKg: 500,
      newTareWeightKg: 12110,
      actualWeightForLoadingKg: 12890,
      payLoadCapacityRcGvwCum: 5,
      supplyPayLoadCapacityOverloadPassCum: 5,
    },
    {
      sNo: 43,
      vehicleNo: "MH 12 SF 2075",
      vehicleType: "TM",
      make: "TATA",
      location: "Mulkhed",
      vehicleTyreDetails: "10 Tyres",
      overLoadPass: "No",
      installedHandiCapacityCum: 6,
      rtoGvwKg: 25000,
      tareWeightKg: 11610,
      weightOfWaterKg: 500,
      newTareWeightKg: 12110,
      actualWeightForLoadingKg: 12890,
      payLoadCapacityRcGvwCum: 5,
      supplyPayLoadCapacityOverloadPassCum: 5,
    },
    {
      sNo: 44,
      vehicleNo: "MH 12 SF 7050",
      vehicleType: "TM",
      make: "TATA",
      location: "Mhalunge",
      vehicleTyreDetails: "10 Tyres",
      overLoadPass: "No",
      installedHandiCapacityCum: 7,
      rtoGvwKg: 25000,
      tareWeightKg: 11610,
      weightOfWaterKg: 500,
      newTareWeightKg: 12110,
      actualWeightForLoadingKg: 12890,
      payLoadCapacityRcGvwCum: 5,
      supplyPayLoadCapacityOverloadPassCum: 5,
    },
  ];
}
