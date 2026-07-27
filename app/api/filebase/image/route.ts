import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "../../../../lib/api-proxy";

const API_BASE = process.env.BEARTH_API_URL!;

export async function POST(req: NextRequest) {
  const token = getSessionToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();

  try {
    const r = await fetch(`${API_BASE}/api/filebase/nft-upload/image`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` },
      body:    formData,
    });
    const data = await r.json();
    return NextResponse.json(data, { status: r.status });
  } catch {
    return NextResponse.json({ error: "API unreachable" }, { status: 503 });
  }
}
