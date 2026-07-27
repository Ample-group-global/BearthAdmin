import { NextRequest } from "next/server";
import { proxyToApi } from "../../../../lib/api-proxy";

export async function GET(req: NextRequest) {
  return proxyToApi(req, "/api/filebase/buckets");
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  return proxyToApi(req, "/api/filebase/buckets", { method: "POST", body });
}
