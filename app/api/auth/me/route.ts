import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

const API_BASE = process.env.BEARTH_API_URL!;

export async function GET(req: NextRequest) {
  const token = req.cookies.get("admin_session")?.value;
  if (!token) return NextResponse.json({ authenticated: false }, { status: 401 });

  // Local HMAC check first (fast path — avoids API round-trip on invalid tokens)
  const local = verifyToken(token);
  if (!local) return NextResponse.json({ authenticated: false }, { status: 401 });

  const LOCAL_FALLBACK = {
    authenticated: true,
    userId: local.userId,
    role: local.role,
    roleCode: local.role,
    roleName: local.role,
    permissions: [] as string[],
    menus: [] as unknown[],
  };

  // Proxy to BearthApi for DB-fresh context (permissions + menus)
  try {
    const apiRes = await fetch(`${API_BASE}/api/auth/admin/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(4000),
    });
    // On any server-side error (5xx) fall back to local token — keeps admins logged in when DB is down
    if (!apiRes.ok) {
      if (apiRes.status >= 500) return NextResponse.json(LOCAL_FALLBACK);
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    const data = await apiRes.json() as {
      authenticated: boolean;
      userId: string;
      roleCode: string;
      roleName: string;
      permissions: string[];
      menus: unknown[];
    };
    // Expose `role` as alias for roleCode so existing layout code keeps working
    return NextResponse.json({ ...data, role: data.roleCode });
  } catch {
    return NextResponse.json(LOCAL_FALLBACK);
  }
}
