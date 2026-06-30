import { NextResponse } from 'next/server';
import { getLayerConfig, saveLayerConfig } from '../../../../lib/studio/layers';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { folder, optional } = await request.json();
  if (!folder || typeof optional !== 'boolean') {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  const config = getLayerConfig();
  const set = new Set(config.optional);
  if (optional) set.add(folder);
  else set.delete(folder);
  saveLayerConfig({ optional: [...set] });
  return NextResponse.json({ ok: true });
}
