import { NextRequest, NextResponse } from "next/server";

const SECRET = process.env.AUTH_SECRET ?? "bearth-admin-secret-please-change-in-production";
const VALID_ROLES = new Set(["admin", "ops", "tech"]);

async function verifyToken(token: string): Promise<{ valid: boolean; role: string }> {
  try {
    const decoded = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
    const lastDot = decoded.lastIndexOf(".");
    if (lastDot === -1) return { valid: false, role: "" };
    const payload = decoded.slice(0, lastDot);
    const sig = decoded.slice(lastDot + 1);
    const parts = payload.split(":");
    if (parts.length < 3) return { valid: false, role: "" };
    const role = parts[1];
    if (!VALID_ROLES.has(role)) return { valid: false, role: "" };
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const expected = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    const expectedHex = Array.from(new Uint8Array(expected)).map(b => b.toString(16).padStart(2, "0")).join("");
    const valid = sig === expectedHex;
    return { valid, role: valid ? role : "" };
  } catch {
    return { valid: false, role: "" };
  }
}

function redirectTo(req: NextRequest, pathname: string): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

const PUBLIC_PATHS = new Set(["/login", "/forgot-password", "/reset-password"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("admin_session")?.value;

  // No token — let public paths through, redirect everything else
  if (!token) {
    if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
    return redirectTo(req, "/login");
  }

  const { valid, role } = await verifyToken(token);
  if (!valid) {
    if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
    return redirectTo(req, "/login");
  }

  // Already logged in — redirect auth/public pages to appropriate section
  if (PUBLIC_PATHS.has(pathname)) {
    if (role === "tech") return redirectTo(req, "/dashboard");
    return redirectTo(req, "/presale");
  }

  // Role-based section guards
  if (pathname.startsWith("/dashboard") && role !== "tech") {
    return redirectTo(req, role === "ops" ? "/ops" : "/presale");
  }
  if (pathname.startsWith("/ops") && role === "tech") {
    return redirectTo(req, "/dashboard");
  }
  if (pathname.startsWith("/presale") && role === "tech") {
    return redirectTo(req, "/dashboard");
  }
  if (pathname.startsWith("/admin") && role === "ops") {
    return redirectTo(req, "/presale");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/forgot-password", "/reset-password", "/presale/:path*", "/dashboard/:path*", "/admin/:path*", "/ops/:path*"],
};
