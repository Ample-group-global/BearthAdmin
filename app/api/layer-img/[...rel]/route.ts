import sharp from 'sharp';

export const dynamic = 'force-dynamic';

const API_BASE = process.env.BEARTH_API_URL ?? 'http://localhost:4000';

async function toThumbnail(input: string | Buffer, w: number, h: number): Promise<Buffer> {
  return sharp(input, { failOn: 'none' })
    .trim({ threshold: 10 })
    .resize(w, h, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

export async function GET(req: Request, { params }: { params: Promise<{ rel: string[] }> }) {
  const rel = (await params).rel.join('/');

  const url = new URL(req.url);
  const w   = parseInt(url.searchParams.get('w') ?? '512') || 512;
  const h   = parseInt(url.searchParams.get('h') ?? '512') || 512;

  try {
    const upstream = await fetch(`${API_BASE}/api/nft-gen/layers/image?rel=${encodeURIComponent(rel)}`);
    if (!upstream.ok) return new Response(null, { status: 404 });
    const raw = Buffer.from(await upstream.arrayBuffer());
    const buf = await toThumbnail(raw, w, h).catch(() => raw);
    return new Response(new Uint8Array(buf), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}
