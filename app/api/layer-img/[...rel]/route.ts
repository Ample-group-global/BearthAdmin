import path  from 'path';
import fs    from 'fs';
import sharp from 'sharp';
import { getLayersDir } from '../../../../lib/studio/layers';

export const dynamic = 'force-dynamic';

const API_BASE = process.env.BEARTH_API_URL ?? 'http://localhost:4000';

export async function GET(req: Request, { params }: { params: Promise<{ rel: string[] }> }) {
  const rel       = (await params).rel.join('/');
  const layersDir = getLayersDir();

  const url = new URL(req.url);
  const w   = parseInt(url.searchParams.get('w') ?? '512') || 512;
  const h   = parseInt(url.searchParams.get('h') ?? '512') || 512;

  // Try local disk first (works in local dev), resize with Sharp
  if (layersDir) {
    const file     = path.join(layersDir, rel);
    const relCheck = path.relative(layersDir, file);
    if (!relCheck.startsWith('..') && !path.isAbsolute(relCheck) && fs.existsSync(file)) {
      try {
        const buf = await sharp(file)
          .resize(w, h, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();
        return new Response(new Uint8Array(buf), {
          headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
        });
      } catch {
        return new Response(null, { status: 500 });
      }
    }
  }

  // Fall back to BearthApi (has Filebase S3 fallback) — used on Vercel
  try {
    const upstream = await fetch(`${API_BASE}/api/nft-gen/layers/image?rel=${encodeURIComponent(rel)}`);
    if (!upstream.ok) return new Response(null, { status: 404 });
    const buf = Buffer.from(await upstream.arrayBuffer());
    return new Response(new Uint8Array(buf), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}
