import path from 'path';
import fs   from 'fs';
import { NextResponse }    from 'next/server';
import { getLayersDir, clearLayersCache } from '../../../../lib/studio/layers';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request) {
  const { rel } = await request.json();
  if (!rel) return NextResponse.json({ error: 'Missing rel' }, { status: 400 });

  const layersDir = getLayersDir();
  const filePath = path.resolve(path.join(layersDir, rel));

  if (!filePath.startsWith(path.resolve(layersDir))) {
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
