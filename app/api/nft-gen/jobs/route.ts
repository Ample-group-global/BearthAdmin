import { NextRequest } from "next/server";
import { proxyToApi } from "../../../../lib/api-proxy";

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  return proxyToApi(req, `/api/nft-gen/jobs${qs ? `?${qs}` : ""}`);
}
