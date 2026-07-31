import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const COLLECTION_COOKIE = 'nft_collection_id';
const NAME_COOKIE       = 'nft_collection_name';
const SUPPLY_COOKIE     = 'nft_supply';
const MAX_AGE           = 30 * 24 * 60 * 60; // 30 days

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  maxAge:   MAX_AGE,
  path:     '/',
};

export async function GET(req: NextRequest) {
  const collectionId = req.cookies.get(COLLECTION_COOKIE)?.value ?? null;
  const name         = req.cookies.get(NAME_COOKIE)?.value       ?? null;
  const supplyRaw    = req.cookies.get(SUPPLY_COOKIE)?.value     ?? null;
  const supply       = supplyRaw ? parseInt(supplyRaw, 10) : null;
  return NextResponse.json({ collectionId, name, supply });
}

export async function POST(req: NextRequest) {
  const { collectionId, name, supply } = await req.json();
  const res = NextResponse.json({ ok: true });
  if (collectionId) res.cookies.set(COLLECTION_COOKIE, collectionId, COOKIE_OPTS);
  if (name)         res.cookies.set(NAME_COOKIE,       name,         COOKIE_OPTS);
  if (supply != null) res.cookies.set(SUPPLY_COOKIE,  String(supply), COOKIE_OPTS);
  return res;
}

export async function DELETE(_req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COLLECTION_COOKIE);
  res.cookies.delete(NAME_COOKIE);
  res.cookies.delete(SUPPLY_COOKIE);
  return res;
}
