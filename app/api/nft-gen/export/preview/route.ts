import { NextRequest } from "next/server";
import { proxyToApi }  from "../../../../../lib/api-proxy";

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  return proxyToApi(req, "/api/nft-gen/export/preview", { method: "POST", body });
}
