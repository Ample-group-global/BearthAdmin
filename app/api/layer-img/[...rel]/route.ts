import path  from 'path';
import fs    from 'fs';
import sharp from 'sharp';
import { LAYERS_DIR } from '../../../../lib/studio/layers';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ rel: string[] }> }) {
  const rel  = (await params).rel.join('/');
  const file = path.join(LAYERS_DIR, rel);

  if (!file.startsWith(LAYERS_DIR) || !fs.existsSync(file)) {
    return new Response(null, { status: 404 });
  }

  const url = new URL(req.url);
  const w   = parseInt(url.searchParams.get('w') ?? '512') || 512;
  const h   = parseInt(url.searchParams.get('h') ?? '512') || 512;

  const buf = await sharp(file)
    .resize(w, h, { fit: 'fill' })
    .png()
    .toBuffer();

  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
