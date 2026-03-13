"use client";

import { useMemo, useState } from "react";
import type { Customer } from "@/types";

export default function CustomerSearch({ initialCustomers }: { initialCustomers: Customer[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q.trim()) return initialCustomers;
    const lower = q.toLowerCase();
    return initialCustomers.filter(
      (c) =>
        c.fullName.toLowerCase().includes(lower) ||
        c.phone.includes(q) ||
        c.area.toLowerCase().includes(lower) ||
        c.building.toLowerCase().includes(lower)
    );
  }, [initialCustomers, q]);

  return (
    <input
      type="search"
      placeholder="Search by name, phone, area, building..."
      value={q}
      onChange={(e) => setQ(e.target.value)}
      className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
    />
  );
}
