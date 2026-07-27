import { NextRequest } from "next/server";
import { proxyToApi } from "../../../../lib/api-proxy";

// GET /api/filebase/objects?bucket=&prefix=
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const sp = new URLSearchParams();
  const bucket = searchParams.get("bucket");
  const prefix = searchParams.get("prefix");
  if (bucket) sp.set("bucket", bucket);
  if (prefix) sp.set("prefix", prefix);
  return proxyToApi(req, "/api/filebase/objects", { searchParams: sp });
}

// DELETE /api/filebase/objects  — single object: { bucket, key }
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  return proxyToApi(req, "/api/filebase/objects", { method: "DELETE", body });
}
