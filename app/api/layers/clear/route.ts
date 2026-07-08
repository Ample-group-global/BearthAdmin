import path from 'path';
import fs   from 'fs';
import { NextResponse }    from 'next/server';
import { getLayersDir, clearLayersCache } from '../../../../lib/studio/layers';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const layersDir = getLayersDir();
    if (fs.existsSync(layersDir)) {
      fs.rmSync(layersDir, { recursive: true, force: true });
    }
    fs.mkdirSync(layersDir, { recursive: true });
    clearLayersCache();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
