import { NextRequest, NextResponse } from "next/server";
import { getAddresses, getMeta, addAddresses } from "@/lib/whitelist-store";

export async function GET() {
  try {
    const [addresses, metadata] = await Promise.all([getAddresses(), getMeta()]);
    return NextResponse.json({ addresses, metadata });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const raw: unknown[] = Array.isArray(body.addresses) ? body.addresses : [body.address].filter(Boolean);
    if (raw.length === 0) {
      return NextResponse.json({ error: "No addresses provided" }, { status: 400 });
    }
    const result = await addAddresses(raw.map(String));
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
