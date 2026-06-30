import { NextRequest, NextResponse } from "next/server";
import { getAddresses } from "@/lib/whitelist-store";

export async function GET(req: NextRequest) {
  try {
    const fmt = new URL(req.url).searchParams.get("format") ?? "json";
    const addresses = await getAddresses();

    if (fmt === "csv") {
      const csv = ["address", ...addresses].join("\n");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="whitelist.csv"`,
        },
      });
    }

    if (fmt === "txt") {
      return new NextResponse(addresses.join("\n"), {
        headers: {
          "Content-Type": "text/plain",
          "Content-Disposition": `attachment; filename="whitelist.txt"`,
        },
      });
    }

    // default: json
    return new NextResponse(JSON.stringify({ addresses }, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="whitelist.json"`,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
