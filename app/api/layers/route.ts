import { scanLayers } from '../../../lib/studio/layers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(scanLayers());
}
