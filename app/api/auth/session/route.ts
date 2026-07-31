import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.BEARTH_API_URL!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${API_BASE}/api/auth/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    const next = NextResponse.json(data, { status: res.status });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) next.headers.set("set-cookie", setCookie);
    return next;
  } catch {
    return NextResponse.json({ error: "API unreachable" }, { status: 503 });
  }
}

export async function DELETE(_req: NextRequest) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/session`, { method: "DELETE" });
    const data = await res.json();
    const next = NextResponse.json(data, { status: res.status });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) next.headers.set("set-cookie", setCookie);
    return next;
  } catch {
    return NextResponse.json({ error: "API unreachable" }, { status: 503 });
  }
}
