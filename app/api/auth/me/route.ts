import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
const API_BASE = process.env.BEARTH_API_URL!;
export async function GET(req: NextRequest) {
  const token = req.cookies.get("admin_session")?.value;
  if (!token) return NextResponse.json({ authenticated: false }, { status: 401 });
  const local = verifyToken(token);
  if (!local) return NextResponse.json({ authenticated: false }, { status: 401 });
  try {
    const apiRes = await fetch(`${API_BASE}/api/auth/admin/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!apiRes.ok) return NextResponse.json({ authenticated: false }, { status: 401 });
    const data = await apiRes.json() as {
      authenticated: boolean;
      userId: string;
      roleCode: string;
      roleName: string;
      permissions: string[];
      menus: unknown[];
    };
    return NextResponse.json({ ...data, role: data.roleCode });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 503 });
  }
}
