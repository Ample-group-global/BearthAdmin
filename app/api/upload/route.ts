import path from 'path';
import fs   from 'fs';
import { NextResponse } from 'next/server';
import { getLayersDir, clearLayersCache } from '../../../lib/studio/layers';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const form = await request.formData();
  const layer = form.get('layer') as string;           // e.g. "4-clothes"
  const files = form.getAll('files') as File[];        // File[]
  const subpaths = form.getAll('subpaths') as string[]; // parallel array to files

  if (!layer) return NextResponse.json({ error: 'layer required' }, { status: 400 });

  // Sanitize layer name – only allow alphanumeric, dash, underscore
  const safe = layer.replace(/[^a-zA-Z0-9\-_]/g, '');
  if (!safe) return NextResponse.json({ error: 'invalid layer name' }, { status: 400 });

  const layerDir = path.join(getLayersDir(), safe);
  fs.mkdirSync(layerDir, { recursive: true });

  const added: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const sub = (subpaths[i] || '').replace(/\.\./g, '').replace(/^\//, '');
    const safeSubDir = sub.split('/').slice(0, -1).join('/'); // directory portion only
    // Extract basename only — drop any path prefix the browser may send
    const baseName = file.name.split(/[\\/]/).pop() ?? file.name;
    const name = baseName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    if (!name.match(/\.(png|webp|jpg|jpeg|gif)$/i)) continue;
    const targetDir = safeSubDir ? path.join(layerDir, safeSubDir) : layerDir;
    fs.mkdirSync(targetDir, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(targetDir, name), buf);
    added.push(sub ? sub + '/' + name : name);
  }

  clearLayersCache();
  return NextResponse.json({ ok: true, added });
}
