import { NextRequest, NextResponse } from "next/server";
import { getProof } from "@/lib/whitelist-store";

const ETH_ADDR = /^0x[0-9a-fA-F]{40}$/;

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();
    if (!address || !ETH_ADDR.test(address)) {
      return NextResponse.json({ error: "Valid Ethereum address required" }, { status: 400 });
    }
    const result = await getProof(address);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
