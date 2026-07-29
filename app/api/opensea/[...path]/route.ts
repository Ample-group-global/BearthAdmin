import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/api-proxy";

const OPENSEA_API_URL = process.env.OPENSEA_API_URL ?? "http://localhost:8000";

async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const token = getSessionToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { path } = await params;
  const apiPath = `/api/opensea/${path.map((s, i) => (i === 0 ? s.toLowerCase() : s)).join("/")}`;
  const url = new URL(apiPath, OPENSEA_API_URL);
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

  try {
    const isBody = req.method !== "GET" && req.method !== "DELETE";
    const response = await fetch(url.toString(), {
      method: req.method,
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${token}`,
        ...(isBody ? { "Content-Type": "application/json" } : {}),
      },
      body: isBody ? await req.text() : undefined,
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: "OpenSea API unreachable" }, { status: 503 });
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH };
