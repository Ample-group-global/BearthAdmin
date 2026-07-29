import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/api-proxy";

const API_BASE  = process.env.BEARTH_API_URL!;
const ADMIN_KEY = process.env.ADMIN_SECRET ?? "";

export async function GET(req: NextRequest) {
  const token = getSessionToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL("/api/whitelist", API_BASE);
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { "x-admin-key": ADMIN_KEY },
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: "API unreachable" }, { status: 503 });
  }
}
