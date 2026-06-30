import path from 'path';
import fs   from 'fs';
import { NextResponse }    from 'next/server';
import { LAYERS_DIR, clearLayersCache } from '../../../../lib/studio/layers';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request) {
  const { rel } = await request.json();
  if (!rel) return NextResponse.json({ error: 'Missing rel' }, { status: 400 });

  const filePath = path.resolve(path.join(LAYERS_DIR, rel));

  // Safety: must stay inside LAYERS_DIR
  if (!filePath.startsWith(path.resolve(LAYERS_DIR))) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    clearLayersCache();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
