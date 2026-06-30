import fs       from 'fs';
import path     from 'path';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — types installed via @types/archiver after npm install
import archiver from 'archiver';
import { NextResponse } from 'next/server';
import { JOBS } from '../../../../lib/studio/jobs';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;
    const job = JOBS.get(jobId);
    if (!job?.outDir || !fs.existsSync(job.outDir)) {
      return NextResponse.json({ error: 'job not found or not ready' }, { status: 404 });
    }

    const {
      cid            = 'PLACEHOLDER_CID',
      format         = 'png',
      collectionName = 'collection',
      metaOnly       = false,
    } = await request.json();

    const outDir  = job.outDir;
    const metaDir = path.join(outDir, 'metadata');

    const chunks: Buffer[] = [];
    await new Promise((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 6 } });
      archive.on('data',  (chunk: Buffer) => chunks.push(chunk));
      archive.on('end',   resolve);
      archive.on('error', reject);

      if (!metaOnly) {
        const formats = format === 'both' ? ['png', 'webp'] : [format];
        for (const fmt of formats) {
          const imgDir = path.join(outDir, fmt);
          if (fs.existsSync(imgDir)) {
            archive.directory(imgDir, fmt);
          } else {
            const files = fs.readdirSync(outDir).filter(f => /^\d+\.png$/.test(f));
            for (const f of files) archive.file(path.join(outDir, f), { name: `png/${f}` });
          }
        }
      }

      if (fs.existsSync(metaDir)) {
        const metaFiles = fs.readdirSync(metaDir).filter(f => f.endsWith('.json'));
        for (const f of metaFiles) {
          try {
            const raw      = JSON.parse(fs.readFileSync(path.join(metaDir, f), 'utf8'));
            const cleanCid = cid.replace(/^ipfs:\/\//, '');
            raw.image      = `ipfs://${cleanCid}/${path.basename(f, '.json')}.png`;
            archive.append(JSON.stringify(raw, null, 2), { name: `metadata/${f}` });
          } catch { /* skip bad file */ }
        }
      }

      archive.finalize();
    });

    const buf      = Buffer.concat(chunks);
    const safeName = collectionName.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();

    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type':        'application/zip',
        'Content-Disposition': `attachment; filename="${safeName}_nfts.zip"`,
        'Content-Length':      String(buf.length),
      },
    });
  } catch (err: any) {
    console.error('[download] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
