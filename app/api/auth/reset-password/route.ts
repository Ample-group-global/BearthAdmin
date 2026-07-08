import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.BEARTH_API_URL!;

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (!token || !password) {
      return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
    }
    if (String(password).length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const apiRes = await fetch(`${API_BASE}/api/auth/admin/reset-password`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ token: String(token), password: String(password) }),
    });

    const data = await apiRes.json();
    if (!apiRes.ok) return NextResponse.json(data, { status: apiRes.status });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
