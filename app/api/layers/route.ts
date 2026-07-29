import { NextRequest, NextResponse } from 'next/server';
import { scanLayers }     from '../../../lib/studio/layers';
import { getSessionToken } from '../../../lib/api-proxy';

export const dynamic = 'force-dynamic';

const API_BASE = process.env.BEARTH_API_URL!;

export async function GET(req: NextRequest) {
  // Try local filesystem first — works on local dev with the layers folder present.
  const local = scanLayers();
  if (local.length > 0) return NextResponse.json(local);

  // On Vercel (no local disk) — fall back to DB layers via BearthApi.
  // Requires ?collectionId=xxx query param.
  const collectionId = req.nextUrl.searchParams.get('collectionId');
  if (!collectionId) return NextResponse.json([]);

  const token = getSessionToken(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const upstream = await fetch(
      `${API_BASE}/api/nft-gen/collections/${collectionId}/layers-organise`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!upstream.ok) return NextResponse.json([]);
    const data = await upstream.json();
    return NextResponse.json(data.layers ?? []);
  } catch {
    return NextResponse.json([]);
  }
}
