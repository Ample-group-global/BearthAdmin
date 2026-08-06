-- ─────────────────────────────────────────────────────────────────────────────
-- Pre-Test DB Reset — run against BearthDev before every fresh phase test cycle
-- Database: postgresql://...@reseau.proxy.rlwy.net:55600/BearthDev
--
-- What this resets:
--   1. nft_wave_pool     — clears all pool assignments
--   2. nft_waves         — clears all scheduling / reveal state (keeps wave definitions)
--   3. nft_records       — resets all to pending (keeps serial / filename / wave_number)
--   4. nft_collection_config — ensures correct contract address
--   5. whitelist         — clears all entries; Phase 2.5 re-adds CW1/CW2/CW4 via API
--
-- Run via:
--   psql "postgresql://postgres:idkniaxoQBYItcwPzEaXgIvnSWaSdKIy@reseau.proxy.rlwy.net:55600/BearthDev" -f tests/reset-db.sql
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Clear wave pool
DELETE FROM nft_wave_pool;

-- 2. Reset wave scheduling (keep wave_number, qty, name — clear timing + reveal state)
UPDATE nft_waves SET
  status              = 'upcoming',
  scheduled_start     = NULL,
  scheduled_end       = NULL,
  reveal_scheduled_at = NULL,
  is_revealed         = FALSE,
  wave_starting_index = NULL,
  sold_count          = 0,
  treasury_count      = 0,
  wave_closed         = FALSE;

-- 3. Reset nft_records to pre-mint state
--    wave_number stays (serials are pre-assigned to waves in Filebase sync)
--    token_id, assigned_wallet, delivery_status all reset
UPDATE nft_records SET
  delivery_status = 'pending',
  token_id        = NULL,
  assigned_wallet = NULL;

-- 4. Ensure contract address is correct in collection config
UPDATE nft_collection_config
SET contract_address = '0xd3b0b081A40a4DF72E20A503Ba7eaE85b2Fb9F66'
WHERE TRUE;

-- 5. Clear whitelist (Phase 2.5 re-adds CW1/CW2/CW4 programmatically before minting)
SELECT whitelist_clear();

-- 6. Reset phase-lock.json reminder (do this manually or it resets on test run)
--    tests/phase-lock.json — set all "locked": false, "status": "pending"

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- After running this SQL, do the following before starting tests:
--
-- A. Reset phase-lock.json (all phases → pending + unlocked):
--    Edit tests/phase-lock.json manually OR just delete it (auto-recreated)
--
-- B. Ensure operations wallet has Sepolia ETH:
--    Address: 0x48ba45309d7a4Ebc7D71e32AC702AbAE8e9fCE48
--    Minimum: 0.1 ETH for wave scheduling + reveal + treasury
--
-- C. Ensure CW wallets have Sepolia ETH:
--    CW1 0x30FC14a4c55F2f603f3d7267F82F3279E8D8501e — 0.01 ETH (gas only)
--    CW2 0xf80AbBFED5856c5D29d6Ac8f2F34407cBE1aDB21 — 0.05 ETH (gas + 1 paid mint)
--    CW3 0xEFe074d19088351f9771A16aB4dF03036a86b51a — 0.10 ETH (gas + 2 paid mints)
--    CW4 0x9EEC062F4978CF48de54fD492b26eCdeb87Be01d — 0.10 ETH (gas + 2 paid mints)
--    CW5 0x59C5347a9B78C8279Cb6b759AEd143Ec53256A62 — 0.05 ETH (gas + 1 paid mint)
--
-- D. Fill in tests/.env.test with private keys for CW1-CW5
--
-- E. Start BearthAdmin (port 3000) + BearthApi (port 8000) locally
--    OR set BASE_URL=https://bearth-admin-it.vercel.app for Vercel testing
--
-- F. Start bearth-customer on port 3001 (Phase 2.5 customer minting):
--    cd ../bearth-customer && npm run dev -- --port 3001
--    OR set CUSTOMER_BASE_URL in tests/.env.test if using a different port
-- ─────────────────────────────────────────────────────────────────────────────
