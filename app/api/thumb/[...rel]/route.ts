export const dynamic = 'force-dynamic';

const API_BASE = process.env.BEARTH_API_URL ?? 'http://localhost:4000';

// Proxies to BearthApi, which serves layer images from Filebase S3 only.
export async function GET(_req: Request, { params }: { params: Promise<{ rel: string[] }> }) {
  const rel = (await params).rel.join('/');

  try {
    const upstream = await fetch(
      `${API_BASE}/api/nft-gen/layers/image?rel=${encodeURIComponent(rel)}`,
    );
    if (!upstream.ok) return new Response(null, { status: 404 });

    const buf = Buffer.from(await upstream.arrayBuffer());
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type':  'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}
