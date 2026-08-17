import { NextRequest } from "next/server";
import { proxyToApi } from "../../../../../lib/api-proxy";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return proxyToApi(req, "/api/nft-gen/layers/set-folder", { method: "POST" });
}
