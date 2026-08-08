import { NextRequest } from "next/server";
import { proxyToApi } from "@/lib/api-proxy";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyToApi(req, `/api/nfts/${id}/sbt`, {
    method: "PUT",
    body: await req.json(),
  });
}