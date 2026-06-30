import { NextRequest, NextResponse } from "next/server";
import { getMeta, setMerkleRootOverride, clearMerkleRootOverride } from "@/lib/whitelist-store";

export async function GET() {
  try {
    const meta = await getMeta();
    return NextResponse.json({ root: meta.merkle_root ?? "" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { root } = await req.json();
    if (!root || typeof root !== "string") {
      return NextResponse.json({ error: "root is required" }, { status: 400 });
    }
    await setMerkleRootOverride(root.trim());
    return NextResponse.json({ ok: true, root: root.trim() });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const root = await clearMerkleRootOverride();
    return NextResponse.json({ ok: true, root });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
