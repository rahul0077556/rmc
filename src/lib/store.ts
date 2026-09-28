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
}

export const db: Db = {
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
}
