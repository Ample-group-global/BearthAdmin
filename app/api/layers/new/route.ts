import path from 'path';
import fs   from 'fs';
import { NextResponse } from 'next/server';
import { LAYERS_DIR, clearLayersCache } from '../../../../lib/studio/layers';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { name } = await request.json();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const safe = name.replace(/[^a-zA-Z0-9\-_ ]/g, '').trim();
  if (!safe) return NextResponse.json({ error: 'invalid name' }, { status: 400 });

  const layerDir = path.join(LAYERS_DIR, safe);
  if (fs.existsSync(layerDir)) return NextResponse.json({ error: 'layer already exists' }, { status: 409 });

  fs.mkdirSync(layerDir, { recursive: true });
  clearLayersCache();
  return NextResponse.json({ ok: true, folder: safe });
}
