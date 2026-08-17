import { NextRequest } from "next/server";
import { proxyToApi }  from "../../../../../lib/api-proxy";

export async function GET(req: NextRequest, { params }: { params: Promise<{ exportId: string }> }) {
  const { exportId } = await params;
  return proxyToApi(req, `/api/nft-gen/export/${exportId}`);
}
