import { NextResponse } from 'next/server';
import { saveTraitName } from '../../../../lib/studio/layers';

export async function POST(request: Request) {
  const { folder, stem, name } = await request.json();
  if (!folder || !stem) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  saveTraitName(folder, stem, name?.trim() || null);
  return NextResponse.json({ ok: true });
}
