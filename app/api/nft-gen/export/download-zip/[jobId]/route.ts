import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "../../../../../../lib/api-proxy";

const API_BASE = process.env.BEARTH_API_URL!;

// Streams a ZIP64 archive from BearthApi directly to the browser.
// Cannot use proxyToApi() here — that buffers response.json() which would
// OOM on a 15–20 GB ZIP. This route pipes the ReadableStream through.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const token = getSessionToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const upstreamUrl = new URL(`/api/nft-gen/export/download-zip/${jobId}`, API_BASE);
  req.nextUrl.searchParams.forEach((v, k) => upstreamUrl.searchParams.set(k, v));

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "API unreachable" }, { status: 503 });
  }

  if (!upstream.ok) {
    try {
      return NextResponse.json(await upstream.json(), { status: upstream.status });
    } catch {
      return NextResponse.json({ error: "Download failed" }, { status: upstream.status });
    }
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/zip",
      "Content-Disposition":
        upstream.headers.get("content-disposition") ?? 'attachment; filename="bearth-nft-collection.zip"',
    },
  });
}
