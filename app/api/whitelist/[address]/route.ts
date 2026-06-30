import { NextRequest, NextResponse } from "next/server";
import { removeAddress } from "@/lib/whitelist-store";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    if (!address) return NextResponse.json({ error: "Address required" }, { status: 400 });
    await removeAddress(address);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
