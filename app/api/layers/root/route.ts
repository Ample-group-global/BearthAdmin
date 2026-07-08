import { NextResponse } from 'next/server';
import { getActiveFolder, setActiveFolder } from '../../../../lib/studio/layers';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ folder: getActiveFolder() });
}

export async function POST(request: Request) {
  const { folder } = await request.json();
  if (!folder || typeof folder !== 'string') {
    return NextResponse.json({ error: 'folder name required' }, { status: 400 });
  }
  const safe = folder.replace(/[^a-zA-Z0-9\-_]/g, '').trim();
  if (!safe) return NextResponse.json({ error: 'invalid folder name' }, { status: 400 });
  setActiveFolder(safe);
  return NextResponse.json({ ok: true, folder: safe });
}
