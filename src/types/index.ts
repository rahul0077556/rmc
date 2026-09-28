export type Role =
  | "owner"
  | "customer"
  | "sales"
  | "sales_manager"
  | "dispatcher"
  | "production"
  | "qa";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  customerId?: string;
  plant: string;
}

export type Grade = "M15" | "M20" | "M25" | "M30" | "M35" | "M40";

export type PoStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type TripStatus =
  | "PLANNED"
  | "SENT_TO_PRODUCTION"
  | "BATCHING"
  | "LOADED"
  | "QC_PENDING"
  | "QC_APPROVED"
  | "QC_REJECTED"
  | "CORRECTING"
  | "REPLACED"
  | "DISPATCHED"
  | "IN_TRANSIT"
  | "DELIVERED";

export type InvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

export type TmStatus = "AVAILABLE" | "ASSIGNED" | "LOADED" | "IN_TRANSIT" | "MAINTENANCE";
export type DriverStatus = "AVAILABLE" | "ASSIGNED" | "UNAVAILABLE";

export interface Site {
  id: string;
  customerId: string;
  name: string;
  address: string;
  contactPerson: string;
  phone: string;
  accessibilityNotes: string;
}

export interface Customer {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  gstin: string;
  creditDays: number;
  creditLimit: number;
  billingAddress: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  customerId: string;
  siteId: string;
  grade: Grade;
  quantity: number;
  deliveredQuantity: number;
  ratePerCum: number;
  deliveryDate: string;
  deliveryTime: string;
  purpose: "Slab" | "Column" | "Beam" | "Footing" | "Other";
  pumpRequired: boolean;
  pumpOwnership?: "Customer Pump" | "Company Pump";
  pumpType?: "Horizontal" | "Vertical";
  pipelineLength?: number;
  workersRequired?: number;
  paymentTerms: string;
  reference: string;
  notes: string;
  status: PoStatus;
  createdBy: string;
  createdAt: string;
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
}

export interface MaterialLine {
  material: string;
  theoretical: number;
  actual: number;
  unit: string;
}

export interface Trip {
  id: string;
  tripNumber: string;
  poId: string;
  sequence: number;
  quantity: number;
  tmId?: string;
  driverId?: string;
  plannedTime: string;
  status: TripStatus;
  batchSheetId?: string;
  challanNumber?: string;
  dispatchTime?: string;
  deliveredAt?: string;
  deliveredQuantity?: number;
  receiverName?: string;
  replacedByTripId?: string;
  lastUpdate: string;
}

export interface BatchSheet {
  id: string;
  batchNumber: string;
  tripId: string;
  materials: MaterialLine[];
  batchTime: string;
  operator: string;
  qcStatus: "PENDING" | "APPROVED" | "REJECTED";
}

export interface QcCheck {
  id: string;
  batchSheetId: string;
  tripId: string;
  physicalInspection: "PASS" | "FAIL";
  slump: number;
  bleeding: "PASS" | "FAIL";
  wrongMix: "PASS" | "FAIL";
  admixtureType: string;
  admixtureQuantity: number;
  remarks: string;
  decision: "APPROVED" | "REJECTED";
  rejectionAction?: "CORRECT" | "REPLACE";
  checkedBy: string;
  checkedAt: string;
}

export interface CubeTest {
  id: string;
  batchSheetId: string;
  grade: Grade;
  castDate: string;
  cubeCount: number;
  age: 3 | 7 | 28;
  dueDate: string;
  testedOn?: string;
  strength?: number;
  result: "PENDING" | "PASS" | "FAIL" | "OVERDUE";
}

export interface MaterialTest {
  id: string;
  material: string;
  test: string;
  result: string;
  testDate: string;
  remarks: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  paidDate: string;
  mode: "Bank Transfer" | "Cheque" | "Cash" | "UPI" | "Other";
  reference: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  poId: string;
  customerId: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  paid: number;
  status: InvoiceStatus;
  tripIds: string[];
}

export interface TransitMixer {
  id: string;
  code: string;
  capacity: 5 | 7 | 8 | 9 | 10;
  status: TmStatus;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  status: DriverStatus;
}

export interface MaterialStock {
  material: string;
  available: number;
  unit: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  message: string;
  entity: string;
}

export interface AppNotification {
  id: string;
  at: string;
  title: string;
  description: string;
  kind: "success" | "warning" | "error" | "info";
  read: boolean;
  roles: Role[];
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiError {
  status: number;
  message: string;
}
