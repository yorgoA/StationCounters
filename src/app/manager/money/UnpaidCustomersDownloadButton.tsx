"use client";

type UnpaidExportRow = {
  customerName: string;
  customerId: string;
  unpaid: number;
};

interface UnpaidCustomersDownloadButtonProps {
  monthKey: string;
  rows: UnpaidExportRow[];
}

function csvEscape(value: string): string {
  const escaped = value.replace(/"/g, "\"\"");
  return `"${escaped}"`;
}

export default function UnpaidCustomersDownloadButton({
  monthKey,
  rows,
}: UnpaidCustomersDownloadButtonProps) {
  const filename = `unpaid-customers-${monthKey}.csv`;

  const handleDownload = () => {
    const header = ["month", "customer_name", "customer_id", "unpaid_lbp"];
    const csvRows = [
      header.join(","),
      ...rows.map((row) =>
        [
          csvEscape(monthKey),
          csvEscape(row.customerName),
          csvEscape(row.customerId),
          String(row.unpaid),
        ].join(",")
      ),
    ];
    const csv = "\uFEFF" + csvRows.join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      Download CSV
    </button>
  );
}
