"use client";

export default function PrintMonthlyBillsButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn-primary flex items-center gap-2"
    >
      <span>🖨</span>
      Print / Save as PDF
    </button>
  );
}
