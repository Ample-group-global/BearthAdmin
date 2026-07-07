import { NextRequest } from "next/server";
import { proxyToApi } from "@/lib/api-proxy";

async function handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToApi(req, `/api/presale/referrers/${id}/referred`);
}

export const GET = handler;
