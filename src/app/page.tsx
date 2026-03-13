import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Link from "next/link";

export default async function HomePage() {
  const session = await getSession();
  if (session.isLoggedIn) {
    if (session.role === "manager") {
      redirect("/manager");
    }
    redirect("/employee");
  }
  redirect("/login");
}
