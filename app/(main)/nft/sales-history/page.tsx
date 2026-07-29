"use client";

import { useState, useEffect, useCallback } from "react";

const IPFS_GATEWAY = "https://amgbearth.myfilebase.com/ipfs";
const ETHERSCAN    = process.env.NEXT_PUBLIC_NETWORK === "mainnet"
  ? "https://etherscan.io/tx/"
  : "https://sepolia.etherscan.io/tx/";

type SaleRecord = {
  serial_number:       string;
  token_id:            number | null;
  wave_num:            number | null;
  wallet:              string | null;
  price_eth:           string | null;
  rarity_tier:         string | null;
  image_ipfs_hash:     string | null;
  is_revealed:         boolean;
  mint_tx_hash:        string | null;
  minted_at:           string | null;
  last_sale_price_eth: string | null;
  last_tx_hash:        string | null;
  sold_at:             string | null;
};

type Summary = {
  wave:           string;
  total_minted:   string;
  total_eth:      string | null;
  total_sold:     string;
  total_sale_eth: string | null;
};

const TIER_COLORS: Record<string, string> = {
  Legendary: "#f59e0b",
  Epic:       "#a855f7",
  Rare:       "#3b82f6",
  Common:     "#6b7280",
};

function shortAddr(addr: string) { return addr.slice(0, 6) + "…" + addr.slice(-4); }
function shortHash(h: string)    { return h.slice(0, 8) + "…" + h.slice(-6); }
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export default function SalesHistoryPage() {
  const [records,  setRecords]  = useState<SaleRecord[]>([]);
  const [summary,  setSummary]  = useState<Summary[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState(0);
  const [wave,     setWave]     = useState("");
  const [wallet,   setWallet]   = useState("");
  const [from,     setFrom]     = useState("");
  const [to,       setTo]       = useState("");
  const [waves,    setWaves]    = useState<Array<{ wave_number: number; name: string }>>([]);

  const LIMIT = 50;

  const fetchData = useCallback(async (pg = 0) => {
    setLoading(true);
    const qs = new URLSearchParams({ limit: String(LIMIT), offset: String(pg * LIMIT) });
    if (wave)   qs.set("wave",   wave);
    if (wallet) qs.set("wallet", wallet);
    if (from)   qs.set("from",   from);
    if (to)     qs.set("to",     to);

    const [histRes, sumRes] = await Promise.all([
      fetch(`/api/nft-sell/admin-sales/history?${qs}`, { credentials: "include" }),
      fetch("/api/nft-sell/admin-sales/history/summary", { credentials: "include" }),
    ]);
    const histJson = await histRes.json().catch(() => ({}));
    const sumJson  = await sumRes.json().catch(() => ({}));

    setRecords(histJson.records ?? []);
    setTotal(histJson.total   ?? 0);
    setSummary(sumJson.summary ?? []);
    setLoading(false);
  }, [wave, wallet, from, to]);

  useEffect(() => {
    fetch("/api/nft-sell/waves", { credentials: "include" })
      .then(r => r.json()).then(d => setWaves(d.waves ?? [])).catch(() => {});
  }, []);

  useEffect(() => { setPage(0); fetchData(0); }, [fetchData]);

  function goPage(p: number) { setPage(p); fetchData(p); }

  async function exportCsv() {
    const qs = new URLSearchParams({ limit: "9999", offset: "0" });
    if (wave)   qs.set("wave",   wave);
    if (wallet) qs.set("wallet", wallet);
    if (from)   qs.set("from",   from);
    if (to)     qs.set("to",     to);
    const res  = await fetch(`/api/nft-sell/admin-sales/history?${qs}`, { credentials: "include" });
    const json = await res.json();
    const rows: SaleRecord[] = json.records ?? [];
    const header = ["Serial #","Token ID","Wave","Wallet","Mint Price (ETH)","Rarity","Mint Tx Hash","Minted At","Last Sale (ETH)","Last Tx Hash","Sold At"];
    const lines  = [header.join(","), ...rows.map(r => [
      r.serial_number, r.token_id ?? "", r.wave_num ?? "", r.wallet ?? "",
      r.price_eth ?? "", r.rarity_tier ?? "", r.mint_tx_hash ?? "", r.minted_at ?? "",
      r.last_sale_price_eth ?? "", r.last_tx_hash ?? "", r.sold_at ?? "",
    ].join(","))];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "sales-history.csv"; a.click();
  }

  const totalPages = Math.ceil(total / LIMIT);

  const waveName = (num: number | null) => {
    if (num == null) return "—";
    const w = waves.find(w => w.wave_number === num);
    return w ? `W${num} — ${w.name}` : `Wave ${num}`;
  };

  return (
    <div className="p-5 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: "#24315f" }}>Sales & Mint History</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
            Wallet, transaction hash, wave, and price for every minted NFT
          </p>
        </div>
        <button onClick={exportCsv}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white"
          style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Summary cards */}
      {summary.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {summary.map(s => (
            <div key={s.wave} className="bg-white rounded-xl shadow-sm"
              style={{ border: "1px solid #e5e7eb", borderLeft: "3px solid #41afeb", padding: "14px 16px" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#9bafc5" }}>
                {waveName(s.wave === "—" ? null : Number(s.wave))}
              </p>
              <p className="text-2xl font-extrabold leading-none" style={{ color: "#24315f" }}>
                {Number(s.total_minted).toLocaleString()}
              </p>
              <p className="text-xs mt-1" style={{ color: "#9bafc5" }}>
                minted · {s.total_eth ? Number(s.total_eth).toFixed(4) : "0"} ETH
              </p>
              {Number(s.total_sold) > 0 && (
                <p className="text-xs mt-0.5" style={{ color: "#16a34a" }}>
                  {s.total_sold} sold · {s.total_sale_eth ? Number(s.total_sale_eth).toFixed(4) : "0"} ETH
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={wave} onChange={e => setWave(e.target.value)}
          className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
          style={{ border: "1px solid #e5e7eb", color: wave ? "#111827" : "#9bafc5" }}>
          <option value="">All Waves</option>
          {waves.map(w => (
            <option key={w.wave_number} value={String(w.wave_number)}>
              W{w.wave_number} — {w.name}
            </option>
          ))}
        </select>

        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9bafc5" }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input placeholder="Search wallet 0x..." value={wallet} onChange={e => setWallet(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-xl text-sm bg-white outline-none"
            style={{ border: "1px solid #e5e7eb", color: "#111827", width: 220 }} />
        </div>

        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
          style={{ border: "1px solid #e5e7eb", color: from ? "#111827" : "#9bafc5" }} />
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
          style={{ border: "1px solid #e5e7eb", color: to ? "#111827" : "#9bafc5" }} />

        {(wave || wallet || from || to) && (
          <button onClick={() => { setWave(""); setWallet(""); setFrom(""); setTo(""); }}
            className="px-3 py-2 rounded-xl text-xs font-semibold"
            style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                {["NFT","Serial #","Wave","Wallet","Mint Price","Rarity","Mint Tx Hash","Minted At","Last Sale","Last Tx","Sold At"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#9bafc5", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap", background: "#fafafa" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} style={{ textAlign: "center", padding: 48, color: "#9bafc5" }}>Loading…</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={11} style={{ textAlign: "center", padding: 64 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
                  <div style={{ fontWeight: 700, color: "#24315f", marginBottom: 4 }}>No sales yet</div>
                  <div style={{ fontSize: 12, color: "#9bafc5" }}>Records will appear here once NFTs are minted on-chain</div>
                </td></tr>
              ) : records.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f9fafb" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  {/* NFT image */}
                  <td style={{ padding: "10px 14px" }}>
                    {r.image_ipfs_hash ? (
                      <img src={`${IPFS_GATEWAY}/${r.image_ipfs_hash}`} alt={r.serial_number}
                        style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", display: "block" }} />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: 8, background: "#f3f4f6", border: "1.5px dashed #d1d5db" }} />
                    )}
                  </td>
                  {/* Serial */}
                  <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                    <div className="font-mono font-bold text-sm" style={{ color: "#24315f" }}>{r.serial_number}</div>
                    {r.token_id != null && <div style={{ fontSize: 11, color: "#9bafc5", marginTop: 2 }}>Token #{r.token_id}</div>}
                  </td>
                  {/* Wave */}
                  <td style={{ padding: "10px 14px" }}>
                    {r.wave_num != null ? (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(65,175,235,0.1)", color: "#41afeb", whiteSpace: "nowrap" }}>
                        {waveName(r.wave_num)}
                      </span>
                    ) : <span style={{ color: "#d1d5db" }}>—</span>}
                  </td>
                  {/* Wallet */}
                  <td style={{ padding: "10px 14px", fontFamily: "monospace" }}>
                    {r.wallet ? (
                      <a href={`https://etherscan.io/address/${r.wallet}`} target="_blank" rel="noreferrer"
                        style={{ color: "#41afeb", textDecoration: "none" }} title={r.wallet}>
                        {shortAddr(r.wallet)}
                      </a>
                    ) : <span style={{ color: "#d1d5db" }}>—</span>}
                  </td>
                  {/* Mint price */}
                  <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                    {r.price_eth
                      ? <span className="font-bold text-xs" style={{ color: "#24315f" }}>{Number(r.price_eth).toFixed(4)} ETH</span>
                      : <span className="text-xs font-semibold" style={{ color: "#16a34a" }}>Free</span>}
                  </td>
                  {/* Rarity */}
                  <td style={{ padding: "10px 14px" }}>
                    {r.rarity_tier ? (
                      <span style={{ color: TIER_COLORS[r.rarity_tier] ?? "#6b7280", fontWeight: 700, fontSize: 12 }}>
                        ● {r.rarity_tier}
                      </span>
                    ) : <span style={{ color: "#d1d5db" }}>—</span>}
                  </td>
                  {/* Mint tx */}
                  <td style={{ padding: "10px 14px", fontFamily: "monospace" }}>
                    {r.mint_tx_hash ? (
                      <a href={`${ETHERSCAN}${r.mint_tx_hash}`} target="_blank" rel="noreferrer"
                        style={{ color: "#7c3aed", textDecoration: "none" }} title={r.mint_tx_hash}>
                        {shortHash(r.mint_tx_hash)}
                      </a>
                    ) : <span style={{ color: "#d1d5db" }}>—</span>}
                  </td>
                  {/* Minted at */}
                  <td style={{ padding: "10px 14px", color: "#6b7280", whiteSpace: "nowrap", fontSize: 12 }}>{fmtDate(r.minted_at)}</td>
                  {/* Last sale */}
                  <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                    {r.last_sale_price_eth
                      ? <span className="text-xs font-bold" style={{ color: "#16a34a" }}>{Number(r.last_sale_price_eth).toFixed(4)} ETH</span>
                      : <span style={{ color: "#d1d5db" }}>—</span>}
                  </td>
                  {/* Last tx */}
                  <td style={{ padding: "10px 14px", fontFamily: "monospace" }}>
                    {r.last_tx_hash ? (
                      <a href={`${ETHERSCAN}${r.last_tx_hash}`} target="_blank" rel="noreferrer"
                        style={{ color: "#7c3aed", textDecoration: "none" }} title={r.last_tx_hash}>
                        {shortHash(r.last_tx_hash)}
                      </a>
                    ) : <span style={{ color: "#d1d5db" }}>—</span>}
                  </td>
                  {/* Sold at */}
                  <td style={{ padding: "10px 14px", color: "#6b7280", whiteSpace: "nowrap", fontSize: 12 }}>{fmtDate(r.sold_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid #f3f4f6" }}>
            <span style={{ fontSize: 13, color: "#9bafc5" }}>
              Showing {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} of {total.toLocaleString()} records
            </span>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => goPage(page - 1)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white"
                style={{ border: "1px solid #e5e7eb", color: page === 0 ? "#d1d5db" : "#374151", cursor: page === 0 ? "default" : "pointer" }}>
                ← Prev
              </button>
              <span style={{ padding: "6px 10px", fontSize: 12, color: "#9bafc5" }}>{page + 1} / {totalPages}</span>
              <button disabled={page >= totalPages - 1} onClick={() => goPage(page + 1)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white"
                style={{ border: "1px solid #e5e7eb", color: page >= totalPages - 1 ? "#d1d5db" : "#374151", cursor: page >= totalPages - 1 ? "default" : "pointer" }}>
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
