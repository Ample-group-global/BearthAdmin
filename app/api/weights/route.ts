import { NextResponse } from 'next/server';
import { getWeights, saveWeights } from '../../../lib/studio/layers';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getWeights());
}

export async function POST(request: Request) {
  const weights = await request.json();
  if (typeof weights !== 'object' || weights === null || Array.isArray(weights)) {
    return NextResponse.json({ error: 'Invalid weights format' }, { status: 400 });
  }
  saveWeights(weights);
  return NextResponse.json({ ok: true });
}
