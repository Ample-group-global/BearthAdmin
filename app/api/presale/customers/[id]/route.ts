import { NextRequest } from "next/server";
import { proxyToApi } from "@/lib/api-proxy";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyToApi(req, `/api/presale/customers/${id}`);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyToApi(req, `/api/presale/customers/${id}`, {
    method: "PUT",
    body: await req.json(),
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyToApi(req, `/api/presale/customers/${id}/status`, {
    method: "PATCH",
    body: await req.json(),
  });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyToApi(req, `/api/presale/customers/${id}`, { method: "DELETE" });
}
