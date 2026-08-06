/**
 * setup-phase2.5.cjs
 *
 * Run ONCE before phase-02.5 tests to:
 *   1. Reset wave scheduling state in DB (keeps nft_records rows)
 *   2. Set new wave schedules in DB (T0 = NOW + 15min)
 *   3. Push all 7 wave schedules on-chain via BearthApi
 *
 * Usage:
 *   node tests/scripts/setup-phase2.5.cjs
 *
 * Prerequisites:
 *   - psql available in PATH
 *   - BearthApi running on localhost:8000
 */

'use strict';
const { execFileSync, execSync } = require('child_process');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

const DB_URL  = 'postgresql://postgres:idkniaxoQBYItcwPzEaXgIvnSWaSdKIy@reseau.proxy.rlwy.net:55600/BearthDev';
const API_URL = 'http://localhost:8000';

// ── Wave schedule (T0 = NOW + 15min) ─────────────────────────────────────────
function buildWaves() {
  const now = Math.floor(Date.now() / 1000);
  const T0  = now + 15 * 60; // 15 min from now

  return [
    { num: 1, start: T0,         end: T0 + 20*60 },
    { num: 2, start: T0 + 21*60, end: T0 + 31*60 },
    { num: 3, start: T0 + 32*60, end: T0 + 42*60 },
    { num: 4, start: T0 + 43*60, end: T0 + 53*60 },
    { num: 5, start: T0 + 54*60, end: T0 + 64*60 },
    { num: 6, start: T0 + 65*60, end: T0 + 75*60 },
    { num: 7, start: T0 + 76*60, end: T0 + 86*60 },
  ];
}

// ── Step 1: SQL reset + set new wave times ────────────────────────────────────
function buildSQL(waves) {
  const waveSets = waves.map(w =>
    `UPDATE nft_waves SET scheduled_start = to_timestamp(${w.start}), scheduled_end = to_timestamp(${w.end}) WHERE wave_number = ${w.num};`
  ).join('\n');

  return `
BEGIN;

-- 1. Clear pool
DELETE FROM nft_wave_pool;

-- 2. Reset wave scheduling (keep wave_number, qty, name, price)
UPDATE nft_waves SET
  status                = 'upcoming',
  scheduled_start       = NULL,
  scheduled_end         = NULL,
  reveal_scheduled_at   = NULL,
  is_revealed           = FALSE,
  wave_revealed         = FALSE,
  wave_revealed_at      = NULL,
  wave_starting_index   = NULL,
  starting_index        = NULL,
  sold_count            = 0,
  treasury_minted_count = 0,
  price_locked          = FALSE,
  wave_closed           = FALSE,
  wave_start_triggered  = FALSE,
  wave_end_triggered    = FALSE,
  wave_reveal_triggered = FALSE,
  vrf_request_id        = NULL,
  vrf_requested_at      = NULL,
  vrf_fulfilled_at      = NULL,
  last_tx_hash          = NULL;

-- 3. Reset nft_records to pre-mint state (keep serial/filename/wave_number)
UPDATE nft_records SET
  delivery_status_id = 'ba0b4232-c75f-4e22-8fa8-b85ec0ee6515',
  token_id           = NULL,
  owner_address      = NULL,
  mint_tx_hash       = NULL,
  minted_at          = NULL,
  is_revealed        = FALSE,
  revealed_at        = NULL,
  on_chain_wave_num  = NULL,
  token_wave         = NULL,
  last_tx_hash       = NULL,
  synced_at          = NULL,
  mint_type          = 'paid';

-- 4. Clear whitelist (phase-02.5 P25-01 re-adds CW1/CW2/CW4)
SELECT whitelist_clear();

-- 5. Set new wave times
${waveSets}

COMMIT;
`;
}

async function main() {
  const waves = buildWaves();
  const T0    = waves[0].start;

  console.log('\n🔧 Phase 2.5 Setup — resetting DB + scheduling waves...\n');
  console.log(`T0 = ${new Date(T0 * 1000).toISOString()} (Wave 1 opens in ~15min)`);
  waves.forEach(w =>
    console.log(`  W${w.num}: ${new Date(w.start*1000).toISOString().slice(11,16)} → ${new Date(w.end*1000).toISOString().slice(11,16)} UTC`)
  );
  console.log('');

  // ── Step 1: DB reset ──────────────────────────────────────────────────────
  console.log('Step 1/3 — Resetting DB...');
  const sql     = buildSQL(waves);
  const sqlFile = path.join(os.tmpdir(), 'setup-phase2.5.sql');
  fs.writeFileSync(sqlFile, sql, 'utf8');
  try {
    execSync(`psql "${DB_URL}" -f "${sqlFile}"`, { stdio: 'inherit' });
    console.log('  DB reset ✓\n');
  } catch (e) {
    console.error('  DB reset failed:', e.message);
    process.exit(1);
  }

  // ── Step 2: Get auth token ────────────────────────────────────────────────
  console.log('Step 2/3 — Authenticating with BearthApi...');
  let token;
  try {
    const r = await fetch(`${API_URL}/api/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'amplecapitalholding@gmail.com', password: 'amplecapitalholding@123' }),
      signal: AbortSignal.timeout(15_000),
    });
    const d = await r.json();
    token = d.token;
    console.log('  Auth token acquired ✓\n');
  } catch (e) {
    console.error('  Auth failed:', e.message);
    process.exit(1);
  }

  // ── Step 3: Push wave schedules on-chain ──────────────────────────────────
  console.log('Step 3/3 — Pushing wave schedules on-chain (7 Sepolia TXs, ~7 min)...');
  for (const w of waves) {
    process.stdout.write(`  Wave ${w.num}: submitting TX... `);
    try {
      const res = await fetch(`${API_URL}/api/nft-sell/waves/${w.num}/schedule`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ startUnix: w.start, endUnix: w.end }),
        signal: AbortSignal.timeout(300_000),
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`✓  txHash=${String(data.txHash).slice(0, 22)}...`);
      } else {
        console.log(`⚠ ${res.status}: ${data.error ?? JSON.stringify(data)}`);
      }
    } catch (e) {
      console.log(`⚠ timeout/error: ${e.message?.slice(0, 60)}`);
    }
  }

  const remaining = T0 - Math.floor(Date.now() / 1000);
  console.log(`\n✅ Setup complete. Wave 1 opens in ~${Math.round(remaining / 60)} min.`);
  console.log('   Run tests now:\n   npx playwright test --config=playwright.phases.config.ts tests/phases/phase-02.5-customer-minting.spec.ts\n');
}

main().catch(e => { console.error(e); process.exit(1); });
