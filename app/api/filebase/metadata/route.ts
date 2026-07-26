import { NextRequest, NextResponse } from "next/server";

const fbBase = () => process.env.FILEBASE_URL ?? "http://localhost:8002";
const fbKey  = () => process.env.FILEBASE_API_KEY ?? "";

// Forward a batch metadata upload to Bearth-Filebase /api/nft-upload/metadata.
// Body: { bucket: string, items: [{ key: string, content: string }] }
// Returns: [{ key: string, cid: string | null }]
export async function POST(req: NextRequest) {
  const body = await req.json();

  const r = await fetch(`${fbBase()}/api/nft-upload/metadata`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", "x-api-key": fbKey() },
    body:    JSON.stringify(body),
  });

  const data = await r.json();
  return NextResponse.json(data, { status: r.status });
}
