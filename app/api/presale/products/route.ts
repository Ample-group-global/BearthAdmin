import { NextRequest } from "next/server";
import { proxyToApi } from "@/lib/api-proxy";

export async function GET(req: NextRequest) {
  return proxyToApi(req, "/api/presale/products", {
    searchParams: new URL(req.url).searchParams,
  });
}

export async function POST(req: NextRequest) {
  return proxyToApi(req, "/api/presale/products", {
    method: "POST",
    body: await req.json(),
  });
}
