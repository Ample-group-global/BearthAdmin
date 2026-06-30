import fs   from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { JOBS } from '../../../../lib/studio/jobs';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = JOBS.get(jobId);
  if (!job) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const url  = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));

  if (!job.outDir || !fs.existsSync(job.outDir)) {
    return NextResponse.json({ status: job.status, done: job.done, total: job.total, items: [] });
  }

  const metaDir = path.join(job.outDir, 'metadata');
  if (!fs.existsSync(metaDir)) {
    return NextResponse.json({ status: job.status, done: job.done, total: job.total, items: [] });
  }

  const allFiles = fs.readdirSync(metaDir)
    .filter(f => f.endsWith('.json'))
    .sort((a, b) => parseInt(a) - parseInt(b));

  const total = allFiles.length;
  const pages = Math.ceil(total / limit);
  const slice = allFiles.slice((page - 1) * limit, page * limit);

  const items = slice.map(f => {
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(metaDir, f), 'utf8'));
      return { index: meta.edition, metadata: meta };
    } catch { return null; }
  }).filter(Boolean);

  return NextResponse.json({
    status: job.status,
    done: job.done,
    total: job.total,
    page,
    pages,
    count: total,
    items,
  });
}
