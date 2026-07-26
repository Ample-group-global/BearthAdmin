import { NextRequest, NextResponse } from "next/server";

const fbBase = () => process.env.FILEBASE_URL ?? "http://localhost:8002";
const fbKey  = () => process.env.FILEBASE_API_KEY ?? "";

// Forward a multipart/form-data image upload to Bearth-Filebase /api/nft-upload/image.
// The FormData contains: file (binary), bucket (string), key (string).
export async function POST(req: NextRequest) {
  const formData = await req.formData();

  const r = await fetch(`${fbBase()}/api/nft-upload/image`, {
    method:  "POST",
    headers: { "x-api-key": fbKey() },
    body:    formData,
  });

  const data = await r.json();
  return NextResponse.json(data, { status: r.status });
}
