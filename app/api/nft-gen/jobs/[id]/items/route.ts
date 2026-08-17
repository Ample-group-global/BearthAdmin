import { NextRequest } from "next/server";
import { proxyToApi }  from "../../../../../../lib/api-proxy";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const qs = req.nextUrl.searchParams.toString();
  return proxyToApi(req, `/api/nft-gen/jobs/${id}/items${qs ? `?${qs}` : ""}`);
}
