import { NextRequest } from "next/server";
import { proxyToApi } from "../../../../../lib/api-proxy";

export async function GET(req: NextRequest, { params }: { params: Promise<{ generateId: string }> }) {
  const { generateId } = await params;
  return proxyToApi(req, `/api/nft-gen/generate/${generateId}`);
}
