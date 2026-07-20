import { NextRequest } from "next/server";
import { proxyToApi } from "@/lib/api-proxy";

type Params = { params: Promise<{ id: string; walletId: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id, walletId } = await params;
  return proxyToApi(req, `/api/customers/${id}/wallets/${walletId}`, {
    method: "DELETE",
  });
}
