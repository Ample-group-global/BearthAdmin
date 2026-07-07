import { NextRequest } from "next/server";
import { proxyToApi } from "@/lib/api-proxy";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyToApi(req, `/api/presale/products/${id}/attributes`);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyToApi(req, `/api/presale/products/${id}/attributes`, {
    method: "PUT",
    body: await req.json().catch(() => ({})),
  });
}
