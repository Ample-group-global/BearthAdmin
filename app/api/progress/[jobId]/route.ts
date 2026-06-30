import { JOBS } from '../../../../lib/studio/jobs';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const encoder   = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      while (true) {
        const job = JOBS.get(jobId);
        if (!job) { send({ error: 'not found' }); break; }
        send({ status: job.status, done: job.done, total: job.total,
               outDir: job.outDir, error: job.error });
        if (job.status === 'done' || job.status === 'error') break;
        await new Promise(r => setTimeout(r, 400));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  });
}
