import { NextRequest } from "next/server";
import { proxyToApi } from "@/lib/api-proxy";

async function handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  if (req.method !== "GET" && req.method !== "DELETE") {
    try { body = await req.json(); } catch { body = undefined; }
  }
  return proxyToApi(req, `/api/presale/payment-methods/${id}`, { method: req.method, body });
}

export const PUT    = handler;
export const DELETE = handler;
