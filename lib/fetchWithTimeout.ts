// fetch() has no default timeout. A hung request here doesn't just fail slow —
// inside a Promise.all batch it blocks every other item in that batch, and
// inside a setInterval poll it can pile up overlapping requests forever.
// Confirmed live 2026-08-17: Preview's "Loading images…" froze at 0% for 45s+
// with no error and no recovery because of exactly this. Every network call in
// the generator should go through this instead of bare fetch().
export async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 15_000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}
