import fs   from 'fs';
import path from 'path';
import { JOBS } from '../../../../../lib/studio/jobs';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string; index: string }> }) {
  const { jobId, index } = await params;
  const job = JOBS.get(jobId);
  if (!job?.outDir) return new Response('not found', { status: 404 });

  // Try png/ subdir first, then webp/, then root (legacy)
  const pngPath  = path.join(job.outDir, 'png',  `${index}.png`);
  const webpPath = path.join(job.outDir, 'webp', `${index}.webp`);
  const legPath  = path.join(job.outDir, `${index}.png`);

  if (fs.existsSync(pngPath)) {
    const buf = fs.readFileSync(pngPath);
    return new Response(new Uint8Array(buf), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' } });
  }
  if (fs.existsSync(webpPath)) {
    const buf = fs.readFileSync(webpPath);
    return new Response(new Uint8Array(buf), { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=3600' } });
  }
  if (fs.existsSync(legPath)) {
    const buf = fs.readFileSync(legPath);
    return new Response(new Uint8Array(buf), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' } });
  }
  return new Response('not found', { status: 404 });
}
