import { NextRequest } from "next/server";
import { proxyToApi } from "@/lib/api-proxy";

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const apiPath = `/api/nft-sell/${path.join("/")}`;
  const sp = req.nextUrl.searchParams;
  let body: unknown;
  if (req.method !== "GET" && req.method !== "DELETE") {
    try { body = await req.json(); } catch { body = undefined; }
  }
  return proxyToApi(req, apiPath, { method: req.method, body, searchParams: sp.size > 0 ? sp : undefined });
}

export const GET    = handler;
export const POST   = handler;
export const PUT    = handler;
export const DELETE = handler;
