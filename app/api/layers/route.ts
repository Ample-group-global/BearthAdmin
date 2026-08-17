import { NextRequest, NextResponse } from 'next/server';
import { getSessionToken } from '../../../lib/api-proxy';

export const dynamic = 'force-dynamic';

const API_BASE = process.env.BEARTH_API_URL!;

// DB is the single source of truth for layer metadata — no local-disk fallback.
export async function GET(req: NextRequest) {
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
