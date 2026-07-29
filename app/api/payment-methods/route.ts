import { NextRequest } from "next/server";
import { proxyToApi } from "@/lib/api-proxy";

export async function GET(req: NextRequest) {
  return proxyToApi(req, "/api/payment-methods");
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { body = undefined; }
  return proxyToApi(req, "/api/payment-methods", { method: "POST", body });
}
