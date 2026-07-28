import { NextRequest } from "next/server";
import { proxyToApi }  from "../../../../lib/api-proxy";

export async function POST(req: NextRequest) {
  const body = await req.json();
  return proxyToApi(req, "/api/nft-gen/export", { method: "POST", body });
}
