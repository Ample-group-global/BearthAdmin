import { NextRequest } from "next/server";
import { proxyToApi } from "@/lib/api-proxy";

export async function GET(req: NextRequest) {
  return proxyToApi(req, "/api/presale/referrers");
}

export async function POST(req: NextRequest) {
  return proxyToApi(req, "/api/presale/referrers", {
    method: "POST",
    body: await req.json(),
  });
}
