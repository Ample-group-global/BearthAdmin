import { NextRequest } from "next/server";
import { proxyToApi } from "@/lib/api-proxy";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyToApi(req, `/api/presale/users/${id}`);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyToApi(req, `/api/presale/users/${id}`, {
    method: "PUT",
    body: await req.json(),
  });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyToApi(req, `/api/presale/users/${id}`, { method: "DELETE" });
}
