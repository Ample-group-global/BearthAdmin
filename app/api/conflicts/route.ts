import { NextResponse } from 'next/server';
import { getConflicts, saveConflicts } from '../../../lib/studio/layers';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getConflicts());
}

export async function POST(request: Request) {
  const rules = await request.json();
  saveConflicts(Array.isArray(rules) ? rules : []);
  return NextResponse.json({ ok: true });
}
