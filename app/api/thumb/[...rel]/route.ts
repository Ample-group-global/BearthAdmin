import path   from 'path';
import fs     from 'fs';
import sharp  from 'sharp';
import { getLayersDir } from '../../../../lib/studio/layers';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ rel: string[] }> }) {
  const rel       = (await params).rel.join('/');
  const layersDir = getLayersDir();
  const file      = path.join(layersDir, rel);

  if (!file.startsWith(layersDir) || !fs.existsSync(file)) {
    return new Response(null, { status: 404 });
  }

  const buf = await sharp(file)
    .resize(200, 200, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
