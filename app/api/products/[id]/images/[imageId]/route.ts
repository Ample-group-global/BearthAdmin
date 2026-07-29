import { NextRequest } from "next/server";
import { proxyToApi } from "@/lib/api-proxy";

type Params = { params: Promise<{ id: string; imageId: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id, imageId } = await params;
  return proxyToApi(req, `/api/products/${id}/images/${imageId}`, { method: "DELETE" });
}
