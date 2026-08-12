// ─── NFT Shared Utilities ─────────────────────────────────────────────────────
// Pure helpers shared by waves/page.tsx and records/page.tsx.
// No React imports — just functions and config maps.

// ─── Date Formatters ──────────────────────────────────────────────────────────

/** "Aug 7, 2026"  — used by waves page */
export function fmtDateShort(dt: string | null): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** "07 Aug 2026"  — used by records page */
export function fmtDateLong(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

/** "Aug 7, 2026 03:00 PM"  — used by records page (fmt) */
export function fmtDatetime(dt: string | null): string {
  if (!dt) return "—";
  const d = new Date(dt);
  return (
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}

/** "Aug 7, 2026, 3:00 PM"  — used by waves page (fmtFull) */
export function fmtDatetimeFull(dt: string | null): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Converts a Date object to the value format expected by datetime-local inputs */
export function toLocalDateTimeInput(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Address / Hash Formatters ────────────────────────────────────────────────

/** "0xabc…ef12"  — 6 + 4 char truncation */
export function shortAddr(addr: string): string {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

/** "abcd1234…abc123"  — 8 + 6 char truncation for tx hashes */
export function shortHash(h: string): string {
  return h.slice(0, 8) + "…" + h.slice(-6);
}

// ─── Rarity Tier Colors ───────────────────────────────────────────────────────

export const TIER_COLORS: Record<string, string> = {
  Legendary: "#f59e0b",
  Epic:      "#a855f7",
  Rare:      "#3b82f6",
  Common:    "#6b7280",
};

// ─── Contract Phase Maps (waves page) ─────────────────────────────────────────

export const PHASE_LABELS: Record<number, string> = {
  0: "Free Mint",
  1: "Paid Mint",
};

export const PHASE_COLORS: Record<number, { color: string; bg: string }> = {
  0: { color: "#7c3aed", bg: "rgba(124,58,237,0.1)" },
  1: { color: "#41afeb", bg: "rgba(65,175,235,0.1)" },
};

// ─── Wave Reveal State Meta (waves page — reveal progress stepper) ────────────

export const STATE_META: Record<string, { label: string; color: string; bg: string }> = {
  revealed:         { label: "Revealed",          color: "#16a34a", bg: "rgba(22,163,74,0.1)"    },
  ready_reveal:     { label: "Ready to Reveal",   color: "#d97706", bg: "rgba(217,119,6,0.12)"   },
  reveal_scheduled: { label: "Reveal Scheduled",  color: "#7c3aed", bg: "rgba(124,58,237,0.1)"   },
  active:           { label: "Active",            color: "#41afeb", bg: "rgba(65,175,235,0.1)"   },
  ended:            { label: "Wave Ended",        color: "#6b7280", bg: "rgba(107,114,128,0.1)"  },
  ended_zero:       { label: "Complete",          color: "#16a34a", bg: "rgba(22,163,74,0.1)"    },
  upcoming:         { label: "Upcoming",          color: "#f59e0b", bg: "rgba(245,158,11,0.1)"   },
  not_scheduled:    { label: "Not Scheduled",     color: "#9bafc5", bg: "rgba(156,163,175,0.1)"  },
};

// ─── Wave Display Status Colors (waves page — main table badge) ───────────────

export const WAVE_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  revealed:         { bg: "rgba(124,58,237,0.1)",  color: "#7c3aed", label: "Revealed"          },
  reveal_scheduled: { bg: "rgba(124,58,237,0.08)", color: "#7c3aed", label: "Reveal Scheduled"  },
  ready_reveal:     { bg: "rgba(217,119,6,0.1)",   color: "#d97706", label: "Ready to Reveal"   },
  active:           { bg: "rgba(65,175,235,0.12)", color: "#41afeb", label: "Active"            },
  upcoming:         { bg: "rgba(156,163,175,0.12)",color: "#9ca3af", label: "Upcoming"          },
  paused:           { bg: "rgba(217,119,6,0.1)",   color: "#d97706", label: "Paused"            },
  closed:           { bg: "rgba(22,163,74,0.1)",   color: "#16a34a", label: "Closed"            },
  ended:            { bg: "rgba(107,114,128,0.1)", color: "#6b7280", label: "Ended"             },
};
