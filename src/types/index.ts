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

export type BillingType = "AMPERE_ONLY" | "KWH_ONLY" | "BOTH" | "FREE";
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
  fixedDiscountAmount: number;
  fixedDiscountPercent: number; // 0–100; mutually exclusive with fixedDiscountAmount
  status: CustomerStatus;
  notes: string;
  createdAt: string;
  freeReason?: string;
  isMonitor?: boolean; // KWH_ONLY or BOTH; links to Ampere customer; excluded from collection
  linkedCustomerId?: string; // Required when isMonitor: customer whose meter we use
}

export interface CreateCustomerInput {
  fullName: string;
  phone: string;
  area: string;
  building: string;
  floor: string;
  apartmentNumber: string;
  subscribedAmpere: number;
  billingType: BillingType;
  fixedDiscountAmount?: number;
  fixedDiscountPercent?: number;
  status?: CustomerStatus;
  notes?: string;
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
  updatedAt: string;
}
