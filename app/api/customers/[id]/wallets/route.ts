import { NextRequest } from "next/server";
import { proxyToApi } from "@/lib/api-proxy";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyToApi(req, `/api/customers/${id}/wallets`);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return proxyToApi(req, `/api/customers/${id}/wallets`, {
    method: "POST",
    body: await req.json(),
  });
}
