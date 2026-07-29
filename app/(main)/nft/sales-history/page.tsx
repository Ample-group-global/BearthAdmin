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

function shortAddr(addr: string) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}
function shortHash(h: string) {
  return h.slice(0, 8) + "…" + h.slice(-6);
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
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

  return (
    <div style={{ padding: "32px 28px", minHeight: "100vh", background: "#0f0f14", color: "#e2e8f0" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>Sales & Mint History</h1>
          <p style={{ fontSize: 13, color: "#94a3b8" }}>Wallet, transaction hash, wave, and price for every minted NFT</p>
        </div>
        <button onClick={exportCsv} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "8px 16px", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
          ↓ Export CSV
        </button>
      </div>

      {/* Summary cards */}
      {summary.length > 0 && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
          {summary.map(s => (
            <div key={s.wave} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "14px 20px", minWidth: 160 }}>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Wave {s.wave}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#f8fafc" }}>{Number(s.total_minted).toLocaleString()}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>minted · {s.total_eth ? Number(s.total_eth).toFixed(4) : "0"} ETH</div>
              {Number(s.total_sold) > 0 && <div style={{ fontSize: 12, color: "#22c55e", marginTop: 2 }}>{s.total_sold} sold · {s.total_sale_eth ? Number(s.total_sale_eth).toFixed(4) : "0"} ETH</div>}
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <select value={wave} onChange={e => setWave(e.target.value)}
          style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "8px 12px", color: "#e2e8f0", fontSize: 13 }}>
          <option value="">All Waves</option>
          {[1,2,3,4,5,6,7].map(w => <option key={w} value={w}>Wave {w}</option>)}
        </select>
        <input placeholder="Search wallet 0x..." value={wallet} onChange={e => setWallet(e.target.value)}
          style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "8px 12px", color: "#e2e8f0", fontSize: 13, width: 220 }} />
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "8px 12px", color: "#e2e8f0", fontSize: 13 }} />
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "8px 12px", color: "#e2e8f0", fontSize: 13 }} />
        <button onClick={() => { setWave(""); setWallet(""); setFrom(""); setTo(""); }}
          style={{ background: "transparent", border: "1px solid #475569", borderRadius: 8, padding: "8px 14px", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
          Clear
        </button>
      </div>

      {/* Table */}
      <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#0f172a", borderBottom: "1px solid #334155" }}>
                {["NFT","Serial #","Wave","Wallet","Mint Price","Rarity","Mint Tx Hash","Minted At","Last Sale","Last Tx","Sold At"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#64748b", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} style={{ textAlign: "center", padding: 48, color: "#64748b" }}>Loading…</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={11} style={{ textAlign: "center", padding: 64, color: "#475569" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>No sales yet</div>
                  <div style={{ fontSize: 12 }}>Records will appear here once NFTs are minted on-chain</div>
                </td></tr>
              ) : records.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #1e293b", transition: "background 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#0f172a")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  {/* NFT image */}
                  <td style={{ padding: "10px 14px" }}>
                    {r.image_ipfs_hash ? (
                      <img src={`${IPFS_GATEWAY}/${r.image_ipfs_hash}`} alt={r.serial_number}
                        style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", display: "block" }} />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: 8, background: "#0f172a", border: "1px dashed #334155" }} />
                    )}
                  </td>
                  {/* Serial */}
                  <td style={{ padding: "10px 14px", fontWeight: 600, color: "#f8fafc", whiteSpace: "nowrap" }}>
                    {r.serial_number}
                    {r.token_id != null && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Token #{r.token_id}</div>}
                  </td>
                  {/* Wave */}
                  <td style={{ padding: "10px 14px", color: "#94a3b8" }}>
                    {r.wave_num != null ? <span style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "2px 8px", fontSize: 12 }}>Wave {r.wave_num}</span> : "—"}
                  </td>
                  {/* Wallet */}
                  <td style={{ padding: "10px 14px", fontFamily: "monospace" }}>
                    {r.wallet ? (
                      <a href={`https://etherscan.io/address/${r.wallet}`} target="_blank" rel="noreferrer"
                        style={{ color: "#60a5fa", textDecoration: "none" }} title={r.wallet}>
                        {shortAddr(r.wallet)}
                      </a>
                    ) : "—"}
                  </td>
                  {/* Mint price */}
                  <td style={{ padding: "10px 14px", color: r.price_eth ? "#f8fafc" : "#475569", whiteSpace: "nowrap" }}>
                    {r.price_eth ? `${Number(r.price_eth).toFixed(4)} ETH` : "Free"}
                  </td>
                  {/* Rarity */}
                  <td style={{ padding: "10px 14px" }}>
                    {r.rarity_tier ? (
                      <span style={{ color: TIER_COLORS[r.rarity_tier] ?? "#94a3b8", fontWeight: 600, fontSize: 12 }}>
                        ● {r.rarity_tier}
                      </span>
                    ) : "—"}
                  </td>
                  {/* Mint tx */}
                  <td style={{ padding: "10px 14px", fontFamily: "monospace" }}>
                    {r.mint_tx_hash ? (
                      <a href={`${ETHERSCAN}${r.mint_tx_hash}`} target="_blank" rel="noreferrer"
                        style={{ color: "#34d399", textDecoration: "none" }} title={r.mint_tx_hash}>
                        {shortHash(r.mint_tx_hash)}
                      </a>
                    ) : "—"}
                  </td>
                  {/* Minted at */}
                  <td style={{ padding: "10px 14px", color: "#94a3b8", whiteSpace: "nowrap", fontSize: 12 }}>{fmtDate(r.minted_at)}</td>
                  {/* Last sale */}
                  <td style={{ padding: "10px 14px", color: r.last_sale_price_eth ? "#22c55e" : "#475569", whiteSpace: "nowrap" }}>
                    {r.last_sale_price_eth ? `${Number(r.last_sale_price_eth).toFixed(4)} ETH` : "—"}
                  </td>
                  {/* Last tx */}
                  <td style={{ padding: "10px 14px", fontFamily: "monospace" }}>
                    {r.last_tx_hash ? (
                      <a href={`${ETHERSCAN}${r.last_tx_hash}`} target="_blank" rel="noreferrer"
                        style={{ color: "#34d399", textDecoration: "none" }} title={r.last_tx_hash}>
                        {shortHash(r.last_tx_hash)}
                      </a>
                    ) : "—"}
                  </td>
                  {/* Sold at */}
                  <td style={{ padding: "10px 14px", color: "#94a3b8", whiteSpace: "nowrap", fontSize: 12 }}>{fmtDate(r.sold_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderTop: "1px solid #334155" }}>
            <span style={{ fontSize: 13, color: "#64748b" }}>
              Showing {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} of {total.toLocaleString()} records
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button disabled={page === 0} onClick={() => goPage(page - 1)}
                style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "6px 14px", color: page === 0 ? "#475569" : "#e2e8f0", cursor: page === 0 ? "default" : "pointer", fontSize: 13 }}>
                ← Prev
              </button>
              <span style={{ padding: "6px 12px", fontSize: 13, color: "#94a3b8" }}>{page + 1} / {totalPages}</span>
              <button disabled={page >= totalPages - 1} onClick={() => goPage(page + 1)}
                style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "6px 14px", color: page >= totalPages - 1 ? "#475569" : "#e2e8f0", cursor: page >= totalPages - 1 ? "default" : "pointer", fontSize: 13 }}>
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
