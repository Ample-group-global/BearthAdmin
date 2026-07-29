import path   from 'path';
import fs     from 'fs';
import sharp  from 'sharp';
import { getLayersDir } from '../../../../lib/studio/layers';

export const dynamic = 'force-dynamic';

const API_BASE = process.env.BEARTH_API_URL ?? 'http://localhost:4000';

export async function GET(req: Request, { params }: { params: Promise<{ rel: string[] }> }) {
  const rel       = (await params).rel.join('/');
  const layersDir = getLayersDir();
  const file      = path.join(layersDir, rel);

  const relCheck = path.relative(layersDir, file);
  const localOk  = !relCheck.startsWith('..') && !path.isAbsolute(relCheck) && fs.existsSync(file);

  if (localOk) {
    try {
      const buf = await sharp(file)
        .trim({ threshold: 10 })
        .resize(160, 160, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .extend({ top: 20, bottom: 20, left: 20, right: 20, background: { r: 0, g: 0, b: 0, alpha: 0 } })
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

  // Local path unavailable (e.g. Vercel serverless) — fall back to Filebase via BearthApi
  try {
    const upstream = await fetch(
      `${API_BASE}/api/nft-gen/layers/image?rel=${encodeURIComponent(rel)}`,
      { headers: { 'x-internal-key': process.env.INTERNAL_API_KEY ?? '' } },
    );
    if (!upstream.ok) return new Response(null, { status: 404 });
    const buf = Buffer.from(await upstream.arrayBuffer());
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}
