import { NextRequest } from "next/server";
import { proxyToApi } from "@/lib/api-proxy";

export async function GET(req: NextRequest) {
  return proxyToApi(req, "/api/presale/products/attribute-templates", {
    searchParams: new URL(req.url).searchParams,
  });
}
