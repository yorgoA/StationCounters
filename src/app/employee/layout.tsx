import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import DashboardLayout from "@/components/DashboardLayout";

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session.isLoggedIn) redirect("/login");
  if (session.role !== "employee") redirect("/manager");

  return <DashboardLayout role="employee">{children}</DashboardLayout>;
}
