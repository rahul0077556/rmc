import {
  auditLog,
  batchSheets,
  cubeTests,
  customers,
  drivers,
  invoices,
  materialStock,
  materialTests,
  notifications,
  payments,
  purchaseOrders,
  qcChecks,
  sites,
  transitMixers,
  trips,
} from "@/lib/mock-data";
import type {
  AuditEntry,
  BatchSheet,
  CubeTest,
  Customer,
  Driver,
  Invoice,
  MaterialStock,
  MaterialTest,
  AppNotification,
  Payment,
  PurchaseOrder,
  QcCheck,
  Site,
  TransitMixer,
  Trip,
} from "@/types";
import type { InventoryItem, WeighbridgeTicket } from "@/api/store";
import type { Employee, PayrollRun } from "@/api/account";

/** In-memory database for the prototype. Mutations here mirror future API writes. */
export interface Db {
  customers: Customer[];
  sites: Site[];
  purchaseOrders: PurchaseOrder[];
  trips: Trip[];
  batchSheets: BatchSheet[];
  qcChecks: QcCheck[];
  cubeTests: CubeTest[];
  materialTests: MaterialTest[];
  invoices: Invoice[];
  payments: Payment[];
  transitMixers: TransitMixer[];
  drivers: Driver[];
  materialStock: MaterialStock[];
  auditLog: AuditEntry[];
  notifications: AppNotification[];
  // New modules
  inventory?: InventoryItem[];
  weighbridge?: WeighbridgeTicket[];
  transitMixerPayloads?: any[];
  employees?: Employee[];
  payroll?: PayrollRun[];
  dprRecords?: any[];
  storeExpenses?: any[];
  storeAttendance?: any[];
  weighbridgeSettings?: any;
}

export function loadDb(): Db {
  if (typeof window !== "undefined") {
    try {
      const saved = window.localStorage.getItem("rmc-mock-v2");
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore parse errors and fallback to defaults
    }
  }
  return {
    customers,
    sites,
    purchaseOrders,
    trips,
    batchSheets,
    qcChecks,
    cubeTests,
    materialTests,
    invoices,
    payments,
    transitMixers,
    drivers,
    materialStock,
    auditLog,
    notifications,
  };
}

export const db: Db = loadDb();

export function getDb(): Db {
  return db;
}

export function saveDb(updatedDb?: Db) {
  if (updatedDb) {
    Object.assign(db, updatedDb);
  }
  localStorage.setItem("rmc-mock-v2", JSON.stringify(db));
}

export function customerById(id: string): Customer | undefined {
  return db.customers.find((c) => c.id === id);
}

export function siteById(id: string): Site | undefined {
  return db.sites.find((s) => s.id === id);
}

export function poById(id: string): PurchaseOrder | undefined {
  return db.purchaseOrders.find((p) => p.id === id);
}

export function tripsForPo(poId: string): Trip[] {
  return db.trips.filter((t) => t.poId === poId);
}

export function recordAudit(actor: string, message: string, entity: string): void {
  db.auditLog.unshift({
    id: `AUD-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    at: new Date().toISOString(),
    actor,
    message,
    entity,
  });
  saveDb();
}
