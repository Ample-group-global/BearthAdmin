import { NextRequest } from "next/server";
import { proxyToApi } from "@/lib/api-proxy";

export async function POST(req: NextRequest) {
  return proxyToApi(req, "/api/nfts/testnet-reset", { method: "POST" });
}
