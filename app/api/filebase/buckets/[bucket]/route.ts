import { NextRequest, NextResponse } from "next/server";

const fbBase = () => process.env.FILEBASE_URL ?? "http://localhost:8002";
const fbKey  = () => process.env.FILEBASE_API_KEY ?? "";

// HEAD the bucket on Filebase — returns { exists: bool, bucket }
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ bucket: string }> },
) {
  const { bucket } = await params;
  const r = await fetch(`${fbBase()}/api/buckets/${encodeURIComponent(bucket)}`, {
    method:  "HEAD",
    headers: { "x-api-key": fbKey() },
  });
  return NextResponse.json({ bucket, exists: r.status === 200 });
}
