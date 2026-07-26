import { NextRequest, NextResponse } from "next/server";

const fbBase = () => process.env.FILEBASE_URL ?? "http://localhost:8002";
const fbKey  = () => process.env.FILEBASE_API_KEY ?? "";

// List tracked NFT objects (with CIDs) from Bearth-Filebase DB.
// Query params: bucket (required), prefix (optional)
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const bucket = searchParams.get("bucket") ?? "";
  const prefix = searchParams.get("prefix") ?? "";

  const qs = new URLSearchParams({ bucket });
  if (prefix) qs.set("prefix", prefix);

  const r = await fetch(`${fbBase()}/api/nft-upload/objects?${qs}`, {
    headers: { "x-api-key": fbKey() },
  });

  const data = await r.json();
  return NextResponse.json(data, { status: r.status });
}
