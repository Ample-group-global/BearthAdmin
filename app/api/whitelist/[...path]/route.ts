import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/api-proxy";

const API_BASE   = process.env.BEARTH_API_URL!;
const ADMIN_KEY  = process.env.ADMIN_SECRET ?? "";

async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  // Must be authenticated in BearthAdmin
  const token = getSessionToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { path } = await params;
  const apiPath = `/api/whitelist/${path.join("/")}`;
  const url = new URL(apiPath, API_BASE);
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

  const headers: Record<string, string> = { "x-admin-key": ADMIN_KEY };

  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "DELETE") {
    try {
      body = JSON.stringify(await req.json());
      headers["Content-Type"] = "application/json";
    } catch { /* no body */ }
  }

  try {
    const response = await fetch(url.toString(), {
      method: req.method,
      headers,
      body,
    });

    const ct = response.headers.get("content-type") ?? "";
    if (ct.includes("text/csv") || ct.includes("text/plain")) {
      const text = await response.text();
      return new NextResponse(text, {
        status: response.status,
        headers: {
          "Content-Type": ct,
          "Content-Disposition": response.headers.get("Content-Disposition") ?? "attachment",
        },
      });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: "API unreachable" }, { status: 503 });
  }
}

export const GET    = handler;
export const POST   = handler;
export const PUT    = handler;
export const PATCH  = handler;
export const DELETE = handler;
