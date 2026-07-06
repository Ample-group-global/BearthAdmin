import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.BEARTH_API_URL!;

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const apiRes = await fetch(`${API_BASE}/api/auth/admin/forgot-password`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email: String(email) }),
    });

    const data = await apiRes.json();
    if (!apiRes.ok) return NextResponse.json(data, { status: apiRes.status });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
