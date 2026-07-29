import path  from 'path';
import fs    from 'fs';
import sharp from 'sharp';
import { getLayersDir } from '../../../../lib/studio/layers';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ rel: string[] }> }) {
  const rel       = (await params).rel.join('/');
  const layersDir = getLayersDir();
  const file      = path.join(layersDir, rel);

  const relCheck = path.relative(layersDir, file);
  if (relCheck.startsWith('..') || path.isAbsolute(relCheck) || !fs.existsSync(file)) {
    return new Response(null, { status: 404 });
  }

  const url = new URL(req.url);
  const w   = parseInt(url.searchParams.get('w') ?? '512') || 512;
  const h   = parseInt(url.searchParams.get('h') ?? '512') || 512;

  try {
    const buf = await sharp(file)
      .resize(w, h, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new Response(null, { status: 500 });
  }
}
