import { NextRequest } from "next/server";
import { proxyToApi } from "../../../../../../lib/api-proxy";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToApi(req, `/api/nft-gen/collections/${id}/sync-from-api-layers`, { method: "POST" });
}
