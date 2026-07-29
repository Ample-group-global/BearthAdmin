import { NextRequest, NextResponse } from 'next/server';
import { getSessionToken } from '../../../lib/api-proxy';

export const dynamic = 'force-dynamic';

const API_BASE = process.env.BEARTH_API_URL!;

// Forward layer PNG uploads to BearthApi which:
//   1. Saves to LAYERS_DIR on Railway disk
//   2. Uploads to Filebase bearth-layers S3 bucket
// This way thumbnails work everywhere (local disk on Railway, S3 on Vercel).
export async function POST(request: NextRequest) {
  const token = getSessionToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const contentType = request.headers.get('content-type') ?? '';
    const resp = await fetch(`${API_BASE}/api/nft-gen/layers/upload`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  contentType,
      },
      // @ts-expect-error — duplex required for streaming body in Node 18+
      duplex: 'half',
      body: request.body,
    });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch {
    return NextResponse.json({ error: 'API unreachable' }, { status: 503 });
  }
}
