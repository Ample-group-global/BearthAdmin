import path from 'path';
import fs   from 'fs';
import { getLayersDir } from '../../../../lib/studio/layers';

export const dynamic = 'force-dynamic';

const API_BASE = process.env.BEARTH_API_URL ?? 'http://localhost:4000';

export async function GET(_req: Request, { params }: { params: Promise<{ rel: string[] }> }) {
  const rel       = (await params).rel.join('/');
  const layersDir = getLayersDir();

  // Try local disk first (works in local dev)
  if (layersDir) {
    const file = path.join(layersDir, rel);
    if (file.startsWith(layersDir) && fs.existsSync(file)) {
      const buf = fs.readFileSync(file);
      return new Response(new Uint8Array(buf), {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
      });
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
