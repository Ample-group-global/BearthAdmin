import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.BEARTH_API_URL!;

export async function GET(req: NextRequest) {
  const token = req.cookies.get("admin_session")?.value;
  if (!token) return NextResponse.json({ authenticated: false }, { status: 401 });

  // Always proxy to BearthApi — it is the authority for token verification and permissions
  const apiRes = await fetch(`${API_BASE}/api/auth/admin/me`, {
    headers: { Authorization: `Bearer ${token}` },
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
}
