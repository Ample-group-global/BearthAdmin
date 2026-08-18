import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "../../../../../../lib/api-proxy";

const API_BASE = process.env.BEARTH_API_URL!;

// Streams the ZIP straight through (upstream.body -> NextResponse) instead
// of buffering it, since offline downloads can be hundreds of MB.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const token = getSessionToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const qs = req.nextUrl.searchParams.toString();
  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}/api/nft-gen/export/download-zip/${jobId}${qs ? `?${qs}` : ""}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return NextResponse.json({ error: "API unreachable" }, { status: 503 });
  }

  if (!upstream.ok) {
    const err = await upstream.json().catch(() => ({ error: "Download failed" }));
    return NextResponse.json(err, { status: upstream.status });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/zip",
      "Content-Disposition": upstream.headers.get("Content-Disposition") ?? "attachment",
    },
  });
}
