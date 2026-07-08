import { NextRequest } from "next/server";
import { proxyToApi } from "@/lib/api-proxy";

export async function GET(req: NextRequest) {
  return proxyToApi(req, "/api/presale/inventory", {
    searchParams: new URL(req.url).searchParams,
  });
}
