import { NextRequest } from "next/server";
import { proxyToApi } from "../../../../../lib/api-proxy";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bucket: string }> },
) {
  const { bucket } = await params;
  return proxyToApi(req, `/api/filebase/buckets/${encodeURIComponent(bucket)}`);
}
