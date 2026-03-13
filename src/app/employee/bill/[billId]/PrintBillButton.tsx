"use client";

export default function PrintBillButton() {
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
