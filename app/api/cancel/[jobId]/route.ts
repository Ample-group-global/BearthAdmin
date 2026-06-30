import { JOBS } from '../../../../lib/studio/jobs';
import { NextResponse } from 'next/server';

export async function POST(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = JOBS.get(jobId);
  if (job) job.cancelled = true;
  return NextResponse.json({ ok: true });
}
