/**
 * Raw row types for Google Sheets (string-based, as sheets store text).
 * Used for mapping between sheet rows and typed entities.
 */

export interface CustomerRow {
  customerId: string;
  fullName: string;
  phone: string;
  area: string;
  building: string;
  floor: string;
  apartmentNumber: string;
  subscribedAmpere: string;
  billingType: string;
  fixedDiscountAmount: string;
  status: string;
  notes: string;
  createdAt: string;
}

export interface BillRow {
  billId: string;
  customerId: string;
  monthKey: string;
  previousCounter: string;
  currentCounter: string;
  usageKwh: string;
  amperePriceSnapshot: string;
  kwhPriceSnapshot: string;
  ampereCharge: string;
  consumptionCharge: string;
  discountApplied: string;
  previousUnpaidBalance: string;
  totalDue: string;
  totalPaid: string;
  remainingDue: string;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRow {
  paymentId: string;
  billId: string;
  customerId: string;
  paymentDate: string;
  amountPaid: string;
  receiptImageUrl: string;
  paymentMethod: string;
  note: string;
  enteredByRole: string;
  createdAt: string;
}

export interface SettingsRow {
  kwhPrice: string;
  currency: string;
  updatedAt: string;
}

export interface AmperePriceTierRow {
  amp: string;
  price: string;
}
