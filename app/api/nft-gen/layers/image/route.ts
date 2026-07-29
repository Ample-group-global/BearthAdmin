import { NextRequest } from "next/server";
import { proxyToApi } from "../../../../../lib/api-proxy";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const rel = req.nextUrl.searchParams.get("rel") ?? "";
  return proxyToApi(req, `/api/nft-gen/layers/image?rel=${encodeURIComponent(rel)}`);
}
