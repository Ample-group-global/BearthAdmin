import path from 'path';
import fs   from 'fs';
import { getLayersDir } from '../../../../lib/studio/layers';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ rel: string[] }> }) {
  const rel       = (await params).rel.join('/');
  const layersDir = getLayersDir();
  const file      = path.join(layersDir, rel);

  if (!file.startsWith(layersDir) || !fs.existsSync(file)) {
    return new Response(null, { status: 404 });
  }

  const buf = fs.readFileSync(file);
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
