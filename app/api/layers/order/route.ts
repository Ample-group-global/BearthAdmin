import { NextResponse } from 'next/server';
import { saveLayerOrder } from '../../../../lib/studio/layers';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { order } = await request.json();
  saveLayerOrder(order);
  return NextResponse.json({ ok: true });
}
