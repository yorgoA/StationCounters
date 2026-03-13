/**
 * Simple password-based auth with iron-session.
 */

import { getIronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import type { UserRole } from "@/types";

export interface SessionData {
  role: UserRole;
  name: string;
  isLoggedIn: boolean;
}

const defaultSession: SessionData = {
  role: "employee",
  name: "",
  isLoggedIn: false,
};

const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || "change-me-32-chars-minimum!!",
  cookieName: "electricity-session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7, // 1 week
  },
};

export async function getSession(): Promise<SessionData> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  return session;
}

export async function setSession(role: UserRole, name: string): Promise<void> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  session.role = role;
  session.name = name;
  session.isLoggedIn = true;
  await session.save();
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  session.destroy();
}

export function verifyPassword(role: UserRole, password: string): boolean {
  const managerPass = process.env.MANAGER_PASSWORD;
  const employeePass = process.env.EMPLOYEE_PASSWORD;

  if (role === "manager" && managerPass) {
    return password === managerPass;
  }
  if (role === "employee" && employeePass) {
    return password === employeePass;
  }
  return false;
}
