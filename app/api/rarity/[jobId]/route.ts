import fs   from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { JOBS } from '../../../../lib/studio/jobs';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = JOBS.get(jobId);
  if (!job?.outDir) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const metaDir = path.join(job.outDir, 'metadata');
  if (!fs.existsSync(metaDir)) return NextResponse.json({ error: 'No metadata' }, { status: 404 });

  const files = fs.readdirSync(metaDir).filter(f => f.endsWith('.json'));
  const total = files.length;

  const allMeta = files.map(f => ({
    index: parseInt(f),
    ...JSON.parse(fs.readFileSync(path.join(metaDir, f), 'utf-8')),
  }));

  // Count how many NFTs have each trait value
  const traitCounts: Record<string, Record<string, number>> = {};
  for (const meta of allMeta) {
    for (const attr of meta.attributes ?? []) {
      if (!traitCounts[attr.trait_type]) traitCounts[attr.trait_type] = {};
      traitCounts[attr.trait_type][attr.value] = (traitCounts[attr.trait_type][attr.value] || 0) + 1;
    }
  }

  // Rarity score = sum(total / trait_count) for each trait
  const scored = allMeta.map(meta => {
    let score = 0;
    for (const attr of meta.attributes ?? []) {
      const count = traitCounts[attr.trait_type]?.[attr.value] || 1;
      score += total / count;
    }
    return { ...meta, rarityScore: Math.round(score * 10) / 10 };
  });

  // Sort rarest first, add rank
  scored.sort((a, b) => b.rarityScore - a.rarityScore);
  scored.forEach((item, idx) => { item.rank = idx + 1; });

  // Pagination
  const url = new URL(request.url);
  const page  = parseInt(url.searchParams.get('page')  ?? '1');
  const limit = parseInt(url.searchParams.get('limit') ?? '24');
  const start = (page - 1) * limit;

  return NextResponse.json({
    total,
    pages: Math.ceil(total / limit),
    page,
    items: scored.slice(start, start + limit),
    traitCounts,
  });
}
