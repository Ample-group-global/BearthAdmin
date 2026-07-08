import { NextRequest } from "next/server";
import { proxyToApi } from "../../../../../../../lib/api-proxy";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToApi(req, `/api/nft-gen/collections/${id}/layers/reorder`, {
    method: "PUT",
    body: await req.json(),
  });
}
