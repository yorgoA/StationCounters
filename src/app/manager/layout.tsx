import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import DashboardLayout from "@/components/DashboardLayout";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session.isLoggedIn) redirect("/login");
  if (session.role !== "manager") redirect("/employee");

  return <DashboardLayout role="manager">{children}</DashboardLayout>;
}
