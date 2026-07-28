import { NextRequest, NextResponse } from "next/server";
import { proxyToApi }  from "../../../../lib/api-proxy";

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid or empty request body" }, { status: 400 });
  }
  return proxyToApi(req, "/api/nft-gen/export", { method: "POST", body });
}
