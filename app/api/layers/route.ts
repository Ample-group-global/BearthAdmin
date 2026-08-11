import { NextRequest, NextResponse } from 'next/server';
import { scanLayers }     from '../../../lib/studio/layers';
import { getSessionToken } from '../../../lib/api-proxy';

export const dynamic = 'force-dynamic';

const API_BASE = process.env.BEARTH_API_URL!;

export async function GET(req: NextRequest) {
  const collectionId = req.nextUrl.searchParams.get('collectionId');

  if (collectionId) {
    // Collection-scoped: DB is always the authoritative source.
    // Previously disk was tried first, silently bypassing DB on local dev.
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

  // No collectionId — scan local disk (local dev, called after a folder drop to
  // build the initial layer list before the collection is saved to DB).
  const local = scanLayers();
  return NextResponse.json(local);
}
