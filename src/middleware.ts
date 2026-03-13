import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Simple session check via cookie presence - full validation happens server-side
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes
  if (pathname === "/login") {
    const sessionCookie = request.cookies.get("electricity-session");
    if (sessionCookie?.value) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Protect dashboard routes
  if (pathname.startsWith("/employee") || pathname.startsWith("/manager")) {
    const sessionCookie = request.cookies.get("electricity-session");
    if (!sessionCookie?.value) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/employee/:path*", "/manager/:path*", "/login"],
};
