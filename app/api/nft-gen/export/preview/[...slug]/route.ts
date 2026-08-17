import { NextRequest, NextResponse } from "next/server";
import { proxyToApi, getSessionToken } from "../../../../../../lib/api-proxy";

const API_BASE = process.env.BEARTH_API_URL!;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;

  // GET /preview/:previewId/img/:edition — binary PNG thumbnail
  if (slug.length === 3 && slug[1] === "img") {
    const token = getSessionToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const [previewId, , edition] = slug;
    try {
      const response = await fetch(
        `${API_BASE}/api/nft-gen/export/preview/${previewId}/img/${edition}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) return NextResponse.json({ error: "Image not found" }, { status: response.status });
      const buf = await response.arrayBuffer();
      return new NextResponse(buf, {
        status: 200,
        headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" },
      });
    } catch {
      return NextResponse.json({ error: "API unreachable" }, { status: 503 });
    }
  }

  // GET /preview/:previewId — status poll
  if (slug.length === 1) {
    return proxyToApi(req, `/api/nft-gen/export/preview/${slug[0]}`);
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
