// =============================================================================
// ROLES & AUTH
// =============================================================================

export type UserRole = "manager" | "employee";

export interface SessionUser {
  role: UserRole;
  name: string;
}

// =============================================================================
// CUSTOMERS
// =============================================================================

export type BillingType = "AMPERE_ONLY" | "KWH_ONLY" | "BOTH" | "FREE" | "FIXED_MONTHLY";
export type CustomerStatus = "ACTIVE" | "INACTIVE";

export interface Customer {
  customerId: string;
  fullName: string;
  phone: string;
  area: string;
  building: string;
  floor: string;
  apartmentNumber: string;
  subscribedAmpere: number;
  billingType: BillingType;
  /** LBP per month (used when billingType === "FIXED_MONTHLY"). */
  fixedMonthlyPrice: number;
  fixedDiscountAmount: number;
  fixedDiscountPercent: number; // 0–100; mutually exclusive with fixedDiscountAmount
  status: CustomerStatus;
  notes: string;
  createdAt: string;
  freeReason?: string;
  isMonitor?: boolean; // Links to main customer; excluded from collection
  linkedCustomerId?: string; // Deprecated: use linkedCustomerIds
  linkedCustomerIds?: string[]; // Required when isMonitor: customers whose meters this monitor tracks
  monitorCategory?: string; // When isMonitor: e.g. elevator, theftcontroller
}

export const MONITOR_CATEGORIES = ["elevator", "theftcontroller"] as const;

export interface CreateCustomerInput {
  fullName: string;
  phone: string;
  area: string;
  building: string;
  floor: string;
  apartmentNumber: string;
  subscribedAmpere: number;
  billingType: BillingType;
  fixedMonthlyPrice?: number;
  fixedDiscountAmount?: number;
  fixedDiscountPercent?: number;
  status?: CustomerStatus;
  notes?: string;
  // Monitor settings (optional; only used when creating a monitor account)
  isMonitor?: boolean;
  linkedCustomerIds?: string[];
  monitorCategory?: string;
}

// =============================================================================
// BILLS
// =============================================================================

export type PaymentStatus = "UNPAID" | "PARTIAL" | "PAID";

export interface Bill {
  billId: string;
  customerId: string;
  monthKey: string; // e.g. "2026-03"
  previousCounter: number;
  currentCounter: number;
  usageKwh: number;
  amperePriceSnapshot: number;
  kwhPriceSnapshot: number;
  ampereCharge: number;
  consumptionCharge: number;
  discountApplied: number;
  previousUnpaidBalance: number;
  totalDue: number;
  totalPaid: number;
  remainingDue: number;
  paymentStatus: PaymentStatus;
  billingTypeSnapshot?: BillingType;
  subscribedAmpereSnapshot?: number;
  fixedMonthlyPriceSnapshot?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBillInput {
  customerId: string;
  monthKey: string;
  previousCounter: number;
  currentCounter: number;
}

// =============================================================================
// PAYMENTS
// =============================================================================

export interface Payment {
  paymentId: string;
  billId: string;
  customerId: string;
  paymentDate: string;
  amountPaid: number;
  receiptImageUrl: string;
  paymentMethod: string;
  note: string;
  enteredByRole: UserRole;
  createdAt: string;
}

export interface CreatePaymentInput {
  billId: string;
  customerId: string;
  paymentDate: string;
  amountPaid: number;
  receiptImageUrl?: string;
  paymentMethod?: string;
  note?: string;
  enteredByRole: UserRole;
}

// =============================================================================
// SETTINGS
// =============================================================================

export interface AmperePriceTier {
  amp: number;
  price: number;
}

export interface Settings {
  kwhPrice: number;
  currency: string;
  usdRate: number; // 1 USD in LBP
  updatedAt: string;
}

export interface MonthlyTariff {
  monthKey: string; // e.g. "2026-03"
  kwhPrice: number;
  updatedAt: string;
}

export interface CustomerBillingHistory {
  entryId: string;
  customerId: string;
  monthKey: string;
  billingType: BillingType;
  subscribedAmpere: number;
  fixedMonthlyPrice: number;
  fixedDiscountAmount: number;
  fixedDiscountPercent: number;
  isMonitor: boolean;
  reason: string;
  updatedByRole: UserRole;
  updatedAt: string;
}

export interface BillingChangeLog {
  logId: string;
  customerId: string;
  monthKey: string;
  oldProfileJson: string;
  newProfileJson: string;
  reason: string;
  updatedByRole: UserRole;
  updatedAt: string;
}

export interface BillingProfileForMonth {
  customerId: string;
  monthKey: string;
  billingType: BillingType;
  subscribedAmpere: number;
  fixedMonthlyPrice: number;
  fixedDiscountAmount: number;
  fixedDiscountPercent: number;
  isMonitor: boolean;
}
