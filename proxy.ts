import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "./lib/auth";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("admin_session")?.value;
  const role = token ? verifyToken(token) : null;

  // Always allow Next.js internals and public API routes
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Root — redirect based on role
  if (pathname === "/") {
    if (role === "tech") return NextResponse.redirect(new URL("/dashboard", request.url));
    if (role === "ops") return NextResponse.redirect(new URL("/ops", request.url));
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Login page — redirect already-authenticated users
  if (pathname === "/login") {
    if (role === "tech") return NextResponse.redirect(new URL("/dashboard", request.url));
    if (role === "ops") return NextResponse.redirect(new URL("/ops", request.url));
    return NextResponse.next();
  }

  // Legacy /admin → tech dashboard contract page
  if (pathname === "/admin") {
    if (role !== "tech") return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.redirect(new URL("/dashboard/contract", request.url));
  }

  // Legacy /whitelist → role-appropriate whitelist page
  if (pathname === "/whitelist") {
    if (role === "tech") return NextResponse.redirect(new URL("/dashboard/whitelist", request.url));
    if (role === "ops") return NextResponse.redirect(new URL("/ops/whitelist", request.url));
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Technical dashboard — requires tech role
  if (pathname.startsWith("/dashboard")) {
    if (role !== "tech") return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.next();
  }

  // Operations dashboard — requires ops role
  if (pathname.startsWith("/ops")) {
    if (role !== "ops") return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
