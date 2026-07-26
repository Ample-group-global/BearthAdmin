import { NextRequest, NextResponse } from "next/server";

const fbBase = () => process.env.FILEBASE_URL ?? "http://localhost:8002";
const fbKey  = () => process.env.FILEBASE_API_KEY ?? "";

export async function GET() {
  const r = await fetch(`${fbBase()}/api/buckets`, {
    headers: { "x-api-key": fbKey() },
  });
  const data = await r.json();
  return NextResponse.json(data, { status: r.status });
}

export async function POST(req: NextRequest) {
  const { name, region } = await req.json();
  const r = await fetch(`${fbBase()}/api/buckets`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", "x-api-key": fbKey() },
    body:    JSON.stringify({ name, region }),
  });
  const data = await r.json();
  return NextResponse.json(data, { status: r.status });
}
