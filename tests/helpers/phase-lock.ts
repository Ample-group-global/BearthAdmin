/**
 * Phase Lock Utility
 *
 * Tracks which test phases have passed and been "locked".
 * A locked phase is skipped on future runs — it's confirmed working.
 * To re-run a locked phase: set its `locked` flag to false in phase-lock.json.
 *
 * Phase order must be respected:
 *   Phase 01 → Phase 02 → Phase 02.5 → Phase 03 → Phase 04
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export type PhaseId = 'phase-01' | 'phase-02' | 'phase-02.5' | 'phase-03' | 'phase-04' | 'phase-05' | 'phase-06';

export interface PhaseState {
  status: 'pending' | 'passed' | 'failed';
  locked: boolean;
  completedAt: string | null;
  passCount: number;
  failCount: number;
}

export type LockFile = Record<PhaseId, PhaseState>;

const LOCK_FILE = join(process.cwd(), 'tests', 'phase-lock.json');

const PHASE_ORDER: PhaseId[] = ['phase-01', 'phase-02', 'phase-02.5', 'phase-03', 'phase-04', 'phase-05', 'phase-06'];

const DEFAULT_STATE: LockFile = {
  'phase-01':   { status: 'pending', locked: false, completedAt: null, passCount: 0, failCount: 0 },
  'phase-02':   { status: 'pending', locked: false, completedAt: null, passCount: 0, failCount: 0 },
  'phase-02.5': { status: 'pending', locked: false, completedAt: null, passCount: 0, failCount: 0 },
  'phase-03':   { status: 'pending', locked: false, completedAt: null, passCount: 0, failCount: 0 },
  'phase-04':   { status: 'pending', locked: false, completedAt: null, passCount: 0, failCount: 0 },
  'phase-05':   { status: 'pending', locked: false, completedAt: null, passCount: 0, failCount: 0 },
  'phase-06':   { status: 'pending', locked: false, completedAt: null, passCount: 0, failCount: 0 },
};

export function getPhaseLocks(): LockFile {
  try {
    const data = JSON.parse(readFileSync(LOCK_FILE, 'utf8')) as Partial<LockFile>;
    // Merge with defaults so new phases (e.g. phase-02.5) are always present
    return { ...DEFAULT_STATE, ...data } as LockFile;
  } catch {
    writeFileSync(LOCK_FILE, JSON.stringify(DEFAULT_STATE, null, 2));
    return { ...DEFAULT_STATE };
  }
}

export function isLocked(phaseId: PhaseId): boolean {
  return getPhaseLocks()[phaseId]?.locked === true;
}

export function isPreviousLocked(phaseId: PhaseId): boolean {
  const idx = PHASE_ORDER.indexOf(phaseId);
  if (idx <= 0) return true;
  return isLocked(PHASE_ORDER[idx - 1]!);
}

export function lockPhase(phaseId: PhaseId): void {
  const locks = getPhaseLocks();
  locks[phaseId] = {
    status: 'passed',
    locked: true,
    completedAt: new Date().toISOString(),
    passCount: (locks[phaseId]?.passCount ?? 0),
    failCount: 0,
  };
  writeFileSync(LOCK_FILE, JSON.stringify(locks, null, 2));
  console.log(`\n🔒 ${phaseId.toUpperCase()} LOCKED — all tests passed. Skipped on future runs.\n   To re-run: set "locked": false in tests/phase-lock.json\n`);
}

export function unlockPhase(phaseId: PhaseId): void {
  const locks = getPhaseLocks();
  locks[phaseId] = { status: 'pending', locked: false, completedAt: null, passCount: 0, failCount: 0 };
  writeFileSync(LOCK_FILE, JSON.stringify(locks, null, 2));
  console.log(`🔓 ${phaseId} UNLOCKED — will run on next test execution.`);
}

export function printPhaseSummary(): void {
  const locks = getPhaseLocks();
  console.log('\n═══════════════ PHASE STATUS SUMMARY ═══════════════');
  for (const id of PHASE_ORDER) {
    const state = locks[id];
    const icon  = state.locked ? '🔒' : state.status === 'failed' ? '❌' : '⏳';
    const when  = state.completedAt ? ` (locked ${new Date(state.completedAt).toLocaleString()})` : '';
    console.log(`  ${icon} ${id.toUpperCase()}: ${state.status.toUpperCase()}${when}`);
  }
  console.log('═══════════════════════════════════════════════════\n');
}
