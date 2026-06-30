import path from 'path';
import fs   from 'fs';
import { NextResponse }    from 'next/server';
import { LAYERS_DIR, clearLayersCache } from '../../../../lib/studio/layers';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    if (fs.existsSync(LAYERS_DIR)) {
      fs.rmSync(LAYERS_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(LAYERS_DIR, { recursive: true });
    clearLayersCache();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
