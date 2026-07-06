import { NextRequest } from "next/server";
import { proxyToApi } from "../../../../../../lib/api-proxy";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToApi(req, `/api/nft-gen/collections/${id}/jobs`, {
    method: "POST",
    body: await req.json(),
  });
}
