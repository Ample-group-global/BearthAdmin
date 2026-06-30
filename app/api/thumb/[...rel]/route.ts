import path   from 'path';
import fs     from 'fs';
import sharp  from 'sharp';
import { LAYERS_DIR } from '../../../../lib/studio/layers';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ rel: string[] }> }) {
  const rel  = (await params).rel.join('/');
  const file = path.join(LAYERS_DIR, rel);

  if (!file.startsWith(LAYERS_DIR) || !fs.existsSync(file)) {
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
