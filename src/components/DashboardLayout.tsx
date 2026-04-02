"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/types";

interface Props {
  role: UserRole;
  children: React.ReactNode;
}

const employeeNav = [
  { href: "/employee", label: "Home" },
  { href: "/employee/customers", label: "Customers" },
  { href: "/employee/readings", label: "Record Reading" },
  { href: "/employee/payments", label: "Record Payment" },
];

const managerNav = [
  { href: "/manager", label: "Home" },
  { href: "/manager/money", label: "Money" },
  { href: "/manager/kwh", label: "kWh" },
  { href: "/manager/monitors", label: "Monitors" },
  { href: "/manager/reports", label: "Reports" },
  { href: "/manager/customers", label: "Customers" },
  { href: "/manager/free-customers", label: "Free Customers" },
  { href: "/manager/bills", label: "Bills" },
  { href: "/manager/payments", label: "Payments" },
  { href: "/manager/settings", label: "Settings" },
];

export default function DashboardLayout({ role, children }: Props) {
  const pathname = usePathname();
  const activePath = pathname ?? "";
  const nav = role === "manager" ? managerNav : employeeNav;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 items-center">
            <div className="flex items-center gap-8">
              <Link href={role === "manager" ? "/manager" : "/employee"} className="font-semibold text-slate-800">
                Electricity MVP
              </Link>
              <nav className="flex gap-4">
                {nav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`text-sm font-medium ${
                      activePath === item.href ||
                      (item.href !== "/manager" && activePath.startsWith(item.href + "/"))
                        ? "text-primary-600"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
