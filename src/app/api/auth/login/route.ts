import { NextResponse } from "next/server";
import { setSession, verifyPassword } from "@/lib/auth";
import type { UserRole } from "@/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { role, password } = body as { role?: string; password?: string };

    if (!role || !password) {
      return NextResponse.json(
        { error: "Role and password are required" },
        { status: 400 }
      );
    }

    const validRole: UserRole | null =
      role === "manager" ? "manager" : role === "employee" ? "employee" : null;
    if (!validRole) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const valid = verifyPassword(validRole, password);
    if (!valid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    await setSession(validRole, validRole === "manager" ? "Manager" : "Employee");

    const redirect =
      validRole === "manager" ? "/manager" : "/employee";
    return NextResponse.json({ success: true, redirect });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
