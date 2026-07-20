"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OSAccount {
  address: string;
  username: string | null;
  profileImageUrl: string | null;
  bannerImageUrl: string | null;
  bio: string | null;
  website: string | null;
  twitterUsername: string | null;
  openseaUrl: string | null;
}

interface OsNft {
  identifier: string;
  collectionSlug: string;
  contractAddress: string;
  chain: string;
  tokenStandard: string | null;
  name: string | null;
  imageUrl: string | null;
  displayImageUrl: string | null;
  isNsfw: boolean;
  isSuspicious: boolean;
}

interface OSCollection {
  slug: string;
  name: string;
  chain: string;
  category: string | null;
  imageUrl: string | null;
}

interface OSListing {
  orderHash: string;
  tokenId: string;
  contractAddress: string;
  chain: string;
  orderType: string;
  maker: string;
  taker: string | null;
  price: string;
  priceCurrency: string;
  startDate: string;
  expirationDate: string;
  cancelled: boolean;
  finalized: boolean;
}

interface OSOffer {
  orderHash: string;
  offerType: string;
  tokenId: string | null;
  contractAddress: string | null;
  chain: string;
  maker: string;
  taker: string | null;
  price: string;
  priceCurrency: string;
  startDate: string;
  expirationDate: string;
  cancelled: boolean;
}

interface OSEvent {
  eventType: string;
  chain: string;
  contractAddress: string;
  tokenId: string;
  collectionSlug: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  price: string | null;
  priceCurrency: string | null;
  transactionHash: string | null;
  eventTimestamp: string;
}

interface OsPortfolioStats {
  totalValueUsd: number | null;
  nftValueUsd: number | null;
  tokenValueUsd: number | null;
  pnlAbsolute: number | null;
  pnlPercentage: number | null;
  timeframe: string;
}

interface OsWalletPnl {
  realizedPnlUsd: number | null;
  unrealizedPnlUsd: number | null;
  totalPnlUsd: number | null;
  netInvestedUsd: number | null;
  currentValueUsd: number | null;
  returnPercentage: string | null;
}

interface OsShelfItem {
  chain: string;
  contractAddress: string;
  tokenId: string;
}

interface OsProfileShelf {
  id: string;
  title: string;
  description: string | null;
  displayOrder: number;
  items: OsShelfItem[];
}

type TabName = "NFTs" | "Collections" | "Listings" | "Offers Received" | "Offers Made" | "Events" | "Portfolio" | "P&L" | "Shelves";

const TABS: TabName[] = ["NFTs", "Collections", "Listings", "Offers Received", "Offers Made", "Events", "Portfolio", "P&L", "Shelves"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtUsd(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

function truncAddr(s: string | null | undefined, chars = 6) {
  if (!s) return "—";
  if (s.length <= chars * 2 + 2) return s;
  return `${s.slice(0, chars)}…${s.slice(-4)}`;
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString();
}

function fmtTs(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleString();
}

function fmtPrice(raw: string | null | undefined, currency: string | null | undefined) {
  if (!raw || raw === "0") return "—";
  try {
    const n = parseFloat(raw) / 1e18;
    return `${n.toFixed(4)} ${currency ?? "ETH"}`;
  } catch {
    return raw;
  }
}

// ─── Chain badge ──────────────────────────────────────────────────────────────

const CHAIN_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  matic:    { bg: "#ede9fe", color: "#7c3aed", label: "Polygon" },
  polygon:  { bg: "#ede9fe", color: "#7c3aed", label: "Polygon" },
  ethereum: { bg: "#dbeafe", color: "#2563eb", label: "Ethereum" },
  solana:   { bg: "#dcfce7", color: "#16a34a", label: "Solana" },
  base:     { bg: "#cffafe", color: "#0891b2", label: "Base" },
  arbitrum: { bg: "#fef3c7", color: "#d97706", label: "Arbitrum" },
  optimism: { bg: "#fee2e2", color: "#dc2626", label: "Optimism" },
};

function ChainBadge({ chain }: { chain: string }) {
  const s = CHAIN_BADGE[chain?.toLowerCase()] ?? { bg: "#f1f5f9", color: "#64748b", label: chain || "—" };
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

// ─── Event badge ──────────────────────────────────────────────────────────────

const EVENT_BADGE: Record<string, { color: string; bg: string }> = {
  sale:     { color: "#16a34a", bg: "#dcfce7" },
  transfer: { color: "#2563eb", bg: "#dbeafe" },
  offer:    { color: "#7c3aed", bg: "#ede9fe" },
  cancel:   { color: "#dc2626", bg: "#fee2e2" },
  list:     { color: "#d97706", bg: "#fef3c7" },
  mint:     { color: "#0891b2", bg: "#cffafe" },
};

function EventBadge({ type }: { type: string }) {
  const s = EVENT_BADGE[type?.toLowerCase()] ?? { color: "#6b7280", bg: "#f3f4f6" };
  return (
    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
      style={{ color: s.color, background: s.bg }}>
      {type}
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ cancelled, finalized }: { cancelled?: boolean; finalized?: boolean }) {
  if (cancelled) return <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: "#fee2e2", color: "#dc2626" }}>Cancelled</span>;
  if (finalized) return <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: "#dcfce7", color: "#16a34a" }}>Finalized</span>;
  return <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: "#dbeafe", color: "#2563eb" }}>Active</span>;
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Spinner({ size = 5 }: { size?: number }) {
  return (
    <svg className={`w-${size} h-${size} animate-spin`} style={{ color: "#9bafc5" }} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function THead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr style={{ borderBottom: "1px solid #e4e7ed", background: "#f8f9fb" }}>
        {cols.map(c => (
          <th key={c} className="text-left px-4 py-2.5 font-semibold whitespace-nowrap text-xs" style={{ color: "#6b7280" }}>
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function EmptyRow({ colSpan, msg }: { colSpan: number; msg: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-10 text-xs" style={{ color: "#9bafc5" }}>{msg}</td>
    </tr>
  );
}

function LoadingRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-10">
        <div className="flex justify-center"><Spinner /></div>
      </td>
    </tr>
  );
}

// ─── Tab tables ───────────────────────────────────────────────────────────────

function NftsTab({ items, loading, next, onLoadMore, loadingMore }: {
  items: OsNft[]; loading: boolean; next?: string | null;
  onLoadMore: () => void; loadingMore: boolean;
}) {
  return (
    <div>
      <table className="w-full text-xs">
        <THead cols={["NFT", "Chain", "Contract", "Standard", "Status"]} />
        <tbody className="divide-y divide-gray-50">
          {loading && <LoadingRow colSpan={5} />}
          {!loading && items.length === 0 && <EmptyRow colSpan={5} msg="No NFTs found for this account." />}
          {!loading && items.map((nft, i) => (
            <tr key={i} style={{ color: "#374151" }}>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  {(nft.displayImageUrl || nft.imageUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={(nft.displayImageUrl || nft.imageUrl)!}
                      alt=""
                      className="w-10 h-10 rounded object-cover flex-shrink-0"
                      style={{ border: "1px solid #e4e7ed" }}
                      onError={e => { e.currentTarget.style.display = "none"; }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded flex-shrink-0 flex items-center justify-center"
                      style={{ background: "#f1f5f9" }}>
                      <svg className="w-4 h-4" style={{ color: "#c4c9d4" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-medium truncate max-w-[180px]" style={{ color: "#24315f" }}>
                      {nft.name || `#${nft.identifier}`}
                    </div>
                    <div className="font-mono text-[10px] mt-0.5" style={{ color: "#9bafc5" }}>{nft.collectionSlug}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-2.5"><ChainBadge chain={nft.chain} /></td>
              <td className="px-4 py-2.5 font-mono text-[10px]" style={{ color: "#41afeb" }}>
                {truncAddr(nft.contractAddress)}
              </td>
              <td className="px-4 py-2.5" style={{ color: "#6b7280" }}>{nft.tokenStandard || "—"}</td>
              <td className="px-4 py-2.5">
                {nft.isSuspicious
                  ? <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: "#fee2e2", color: "#dc2626" }}>Suspicious</span>
                  : nft.isNsfw
                    ? <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: "#fef3c7", color: "#d97706" }}>NSFW</span>
                    : <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: "#dcfce7", color: "#16a34a" }}>Safe</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {next && !loading && (
        <div className="flex justify-center py-3 border-t" style={{ borderColor: "#e4e7ed" }}>
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold"
            style={{ border: "1px solid #e4e7ed", color: "#374151" }}
          >
            {loadingMore ? <Spinner size={3} /> : null}
            Load More
          </button>
        </div>
      )}
    </div>
  );
}

function CollectionsTab({ items, loading }: { items: OSCollection[]; loading: boolean }) {
  return (
    <table className="w-full text-xs">
      <THead cols={["Collection", "Chain", "Category"]} />
      <tbody className="divide-y divide-gray-50">
        {loading && <LoadingRow colSpan={3} />}
        {!loading && items.length === 0 && <EmptyRow colSpan={3} msg="No collections found for this account." />}
        {!loading && items.map((c, i) => (
          <tr key={i} style={{ color: "#374151" }}>
            <td className="px-4 py-2.5">
              <div className="flex items-center gap-2">
                {c.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.imageUrl} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0"
                    style={{ border: "1px solid #e4e7ed" }}
                    onError={e => { e.currentTarget.style.display = "none"; }} />
                ) : (
                  <div className="w-8 h-8 rounded flex-shrink-0" style={{ background: "#f1f5f9" }} />
                )}
                <div>
                  <div className="font-medium" style={{ color: "#24315f" }}>{c.name || "—"}</div>
                  <div className="font-mono text-[10px]" style={{ color: "#9bafc5" }}>{c.slug}</div>
                </div>
              </div>
            </td>
            <td className="px-4 py-2.5"><ChainBadge chain={c.chain} /></td>
            <td className="px-4 py-2.5">
              {c.category
                ? <span className="px-2 py-0.5 rounded text-[10px] font-semibold"
                    style={{ background: "#f1f5f9", color: "#6b7280" }}>
                    {c.category}
                  </span>
                : <span style={{ color: "#c4c9d4" }}>—</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ListingsTab({ items, loading }: { items: OSListing[]; loading: boolean }) {
  return (
    <table className="w-full text-xs">
      <THead cols={["Order Hash", "Chain", "Token ID", "Price", "Expiry", "Maker", "Status"]} />
      <tbody className="divide-y divide-gray-50">
        {loading && <LoadingRow colSpan={7} />}
        {!loading && items.length === 0 && <EmptyRow colSpan={7} msg="No listings found for this account." />}
        {!loading && items.map((row, i) => (
          <tr key={i} style={{ color: "#374151" }}>
            <td className="px-4 py-2.5 font-mono text-[10px]" title={row.orderHash}>
              {truncAddr(row.orderHash, 10)}
            </td>
            <td className="px-4 py-2.5"><ChainBadge chain={row.chain} /></td>
            <td className="px-4 py-2.5 font-mono">{row.tokenId || "—"}</td>
            <td className="px-4 py-2.5 font-semibold" style={{ color: "#24315f" }}>
              {fmtPrice(row.price, row.priceCurrency)}
            </td>
            <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "#9bafc5" }}>{fmtDate(row.expirationDate)}</td>
            <td className="px-4 py-2.5 font-mono text-[10px]" title={row.maker}>{truncAddr(row.maker)}</td>
            <td className="px-4 py-2.5"><StatusBadge cancelled={row.cancelled} finalized={row.finalized} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function OffersTab({ items, loading, label }: { items: OSOffer[]; loading: boolean; label: string }) {
  return (
    <table className="w-full text-xs">
      <THead cols={["Order Hash", "Chain", "Token ID", "Type", "Price", "Expiry", "Maker", "Cancelled"]} />
      <tbody className="divide-y divide-gray-50">
        {loading && <LoadingRow colSpan={8} />}
        {!loading && items.length === 0 && <EmptyRow colSpan={8} msg={`No ${label.toLowerCase()} found.`} />}
        {!loading && items.map((row, i) => (
          <tr key={i} style={{ color: "#374151" }}>
            <td className="px-4 py-2.5 font-mono text-[10px]" title={row.orderHash}>
              {truncAddr(row.orderHash, 10)}
            </td>
            <td className="px-4 py-2.5"><ChainBadge chain={row.chain} /></td>
            <td className="px-4 py-2.5 font-mono">{row.tokenId || "—"}</td>
            <td className="px-4 py-2.5">
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold"
                style={{ background: "#ede9fe", color: "#7c3aed" }}>
                {row.offerType || "offer"}
              </span>
            </td>
            <td className="px-4 py-2.5 font-semibold" style={{ color: "#d97706" }}>
              {fmtPrice(row.price, row.priceCurrency)}
            </td>
            <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "#9bafc5" }}>{fmtDate(row.expirationDate)}</td>
            <td className="px-4 py-2.5 font-mono text-[10px]" title={row.maker}>{truncAddr(row.maker)}</td>
            <td className="px-4 py-2.5">
              {row.cancelled
                ? <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: "#fee2e2", color: "#dc2626" }}>Yes</span>
                : <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: "#dcfce7", color: "#16a34a" }}>No</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EventsTab({ items, loading, next, onLoadMore, loadingMore }: {
  items: OSEvent[]; loading: boolean; next?: string | null;
  onLoadMore: () => void; loadingMore: boolean;
}) {
  return (
    <div>
      <table className="w-full text-xs">
        <THead cols={["Type", "Chain", "Token ID", "Price", "From", "To", "Tx Hash", "Timestamp"]} />
        <tbody className="divide-y divide-gray-50">
          {loading && <LoadingRow colSpan={8} />}
          {!loading && items.length === 0 && <EmptyRow colSpan={8} msg="No events found for this account." />}
          {!loading && items.map((ev, i) => (
            <tr key={i} style={{ color: "#374151" }}>
              <td className="px-4 py-2.5 whitespace-nowrap"><EventBadge type={ev.eventType} /></td>
              <td className="px-4 py-2.5"><ChainBadge chain={ev.chain} /></td>
              <td className="px-4 py-2.5 font-mono">{ev.tokenId || "—"}</td>
              <td className="px-4 py-2.5 font-semibold" style={{ color: "#24315f" }}>
                {fmtPrice(ev.price, ev.priceCurrency)}
              </td>
              <td className="px-4 py-2.5 font-mono text-[10px]" title={ev.fromAddress ?? ""}>{truncAddr(ev.fromAddress)}</td>
              <td className="px-4 py-2.5 font-mono text-[10px]" title={ev.toAddress ?? ""}>{truncAddr(ev.toAddress)}</td>
              <td className="px-4 py-2.5 font-mono text-[10px]" title={ev.transactionHash ?? ""}>
                {truncAddr(ev.transactionHash, 8)}
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "#9bafc5" }}>{fmtTs(ev.eventTimestamp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {next && !loading && (
        <div className="flex justify-center py-3 border-t" style={{ borderColor: "#e4e7ed" }}>
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold"
            style={{ border: "1px solid #e4e7ed", color: "#374151" }}
          >
            {loadingMore ? <Spinner size={3} /> : null}
            Load More
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Portfolio / P&L / Shelves tabs ──────────────────────────────────────────

const TIMEFRAMES = ["HOUR", "DAY", "WEEK", "MONTH"] as const;

function PortfolioTab({
  stats,
  loading,
  timeframe,
  onTimeframeChange,
}: {
  stats: OsPortfolioStats | null;
  loading: boolean;
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
}) {
  return (
    <div className="p-4">
      {/* Timeframe pills */}
      <div className="flex items-center gap-2 mb-4">
        {TIMEFRAMES.map(tf => (
          <button
            key={tf}
            onClick={() => onTimeframeChange(tf)}
            className="px-3 py-1 rounded-full text-[10px] font-bold transition-colors"
            style={
              timeframe === tf
                ? { background: "#24315f", color: "#fff" }
                : { background: "#f1f5f9", color: "#9bafc5", border: "1px solid #e4e7ed" }
            }
          >
            {tf}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-10"><Spinner /></div>
      )}

      {!loading && !stats && (
        <div className="text-center py-10 text-xs" style={{ color: "#9bafc5" }}>
          Portfolio data not available for this address.
        </div>
      )}

      {!loading && stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: "Total Value", value: fmtUsd(stats.totalValueUsd), pnl: false },
            { label: "NFT Value", value: fmtUsd(stats.nftValueUsd), pnl: false },
            { label: "Token Value", value: fmtUsd(stats.tokenValueUsd), pnl: false },
            { label: "P&L (Absolute)", value: fmtUsd(stats.pnlAbsolute), pnl: true, raw: stats.pnlAbsolute },
            { label: "P&L %", value: stats.pnlPercentage != null ? `${stats.pnlPercentage >= 0 ? "+" : ""}${stats.pnlPercentage.toFixed(2)}%` : "—", pnl: true, raw: stats.pnlPercentage },
          ].map(item => (
            <div
              key={item.label}
              className="rounded-lg px-4 py-3"
              style={{ border: "1px solid #e4e7ed", background: "#fafbfc" }}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "#9bafc5" }}>
                {item.label}
              </div>
              <div
                className="text-sm font-bold"
                style={{
                  color: item.pnl && item.raw != null
                    ? (item.raw > 0 ? "#16a34a" : item.raw < 0 ? "#dc2626" : "#24315f")
                    : "#24315f",
                }}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PnlTab({ pnl, loading }: { pnl: OsWalletPnl | null; loading: boolean }) {
  return (
    <div className="p-4">
      {loading && (
        <div className="flex justify-center py-10"><Spinner /></div>
      )}

      {!loading && !pnl && (
        <div className="text-center py-10 text-xs" style={{ color: "#9bafc5" }}>
          P&amp;L data not available for this address.
        </div>
      )}

      {!loading && pnl && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: "Realized P&L", value: fmtUsd(pnl.realizedPnlUsd), raw: pnl.realizedPnlUsd, isUsd: true },
            { label: "Unrealized P&L", value: fmtUsd(pnl.unrealizedPnlUsd), raw: pnl.unrealizedPnlUsd, isUsd: true },
            { label: "Total P&L", value: fmtUsd(pnl.totalPnlUsd), raw: pnl.totalPnlUsd, isUsd: true },
            { label: "Net Invested", value: fmtUsd(pnl.netInvestedUsd), raw: null, isUsd: false },
            { label: "Current Value", value: fmtUsd(pnl.currentValueUsd), raw: null, isUsd: false },
            {
              label: "Return %",
              value: pnl.returnPercentage != null
                ? (parseFloat(pnl.returnPercentage) >= 0 ? `+${pnl.returnPercentage}%` : `${pnl.returnPercentage}%`)
                : "—",
              raw: pnl.returnPercentage != null ? parseFloat(pnl.returnPercentage) : null,
              isUsd: true,
            },
          ].map(item => (
            <div
              key={item.label}
              className="rounded-lg px-4 py-3"
              style={{ border: "1px solid #e4e7ed", background: "#fafbfc" }}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "#9bafc5" }}>
                {item.label}
              </div>
              <div
                className="text-sm font-bold"
                style={{
                  color: item.isUsd && item.raw != null
                    ? (item.raw > 0 ? "#16a34a" : item.raw < 0 ? "#dc2626" : "#24315f")
                    : "#24315f",
                }}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ShelvesTab({ shelves, loading }: { shelves: OsProfileShelf[]; loading: boolean }) {
  return (
    <div className="p-4">
      {loading && (
        <div className="flex justify-center py-10"><Spinner /></div>
      )}

      {!loading && shelves.length === 0 && (
        <div className="text-center py-10 text-xs" style={{ color: "#9bafc5" }}>
          No shelves found for this profile.
        </div>
      )}

      {!loading && shelves.length > 0 && (
        <div className="space-y-3">
          {shelves.map(shelf => (
            <div
              key={shelf.id}
              className="rounded-lg p-4"
              style={{ border: "1px solid #e4e7ed", background: "#fafbfc" }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold" style={{ color: "#24315f" }}>{shelf.title}</span>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "#e4e7ed", color: "#6b7280" }}
                >
                  {shelf.items.length} item{shelf.items.length !== 1 ? "s" : ""}
                </span>
              </div>
              {shelf.description && (
                <p className="text-xs mb-2 line-clamp-2" style={{ color: "#6b7280" }}>{shelf.description}</p>
              )}
              {shelf.items.length > 0 && (
                <div className="mt-2 space-y-1">
                  {shelf.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-[10px]" style={{ color: "#6b7280" }}>
                      <ChainBadge chain={item.chain} />
                      <span className="font-mono" style={{ color: "#41afeb" }}>{truncAddr(item.contractAddress)}</span>
                      <span style={{ color: "#9bafc5" }}>#{item.tokenId}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Profile card ─────────────────────────────────────────────────────────────

function ProfileCard({ account }: { account: OSAccount }) {
  return (
    <div className="flex items-start gap-4">
      {account.profileImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={account.profileImageUrl}
          alt={account.username ?? ""}
          className="w-16 h-16 rounded-full object-cover flex-shrink-0"
          style={{ border: "2px solid #e4e7ed" }}
          onError={e => { e.currentTarget.style.display = "none"; }}
        />
      ) : (
        <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "#e4e7ed" }}>
          <svg className="w-8 h-8" style={{ color: "#9bafc5" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h2 className="text-base font-bold" style={{ color: "#24315f" }}>
            {account.username || "(no username)"}
          </h2>
          {account.openseaUrl && (
            <a href={account.openseaUrl} target="_blank" rel="noreferrer"
              className="text-[10px] font-semibold px-2 py-0.5 rounded"
              style={{ background: "#dbeafe", color: "#2563eb" }}>
              OpenSea ↗
            </a>
          )}
        </div>
        <p className="font-mono text-xs mb-2" style={{ color: "#9bafc5" }}>{account.address}</p>
        {account.bio && <p className="text-xs mb-2 line-clamp-2" style={{ color: "#374151" }}>{account.bio}</p>}
        <div className="flex flex-wrap gap-4">
          {account.website && (
            <a href={account.website} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-xs font-medium" style={{ color: "#41afeb" }}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              {account.website}
            </a>
          )}
          {account.twitterUsername && (
            <a href={`https://twitter.com/${account.twitterUsername}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-xs font-medium" style={{ color: "#1d9bf0" }}>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              @{account.twitterUsername}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const address = decodeURIComponent(params["address"] as string);

  const [account, setAccount] = useState<OSAccount | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountError, setAccountError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const [activeTab, setActiveTab] = useState<TabName>("NFTs");
  const [tabLoading, setTabLoading] = useState(false);
  const [tabError, setTabError] = useState("");
  const [loadedTabs, setLoadedTabs] = useState<Set<TabName>>(new Set());

  // Tab data
  const [nfts, setNfts] = useState<OsNft[]>([]);
  const [nftsNext, setNftsNext] = useState<string | null>(null);
  const [nftsLoadingMore, setNftsLoadingMore] = useState(false);

  const [collections, setCollections] = useState<OSCollection[]>([]);
  const [listings, setListings] = useState<OSListing[]>([]);
  const [offersReceived, setOffersReceived] = useState<OSOffer[]>([]);
  const [offersMade, setOffersMade] = useState<OSOffer[]>([]);

  const [events, setEvents] = useState<OSEvent[]>([]);
  const [eventsNext, setEventsNext] = useState<string | null>(null);
  const [eventsLoadingMore, setEventsLoadingMore] = useState(false);

  const [portfolio, setPortfolio] = useState<OsPortfolioStats | null>(null);
  const [portfolioTimeframe, setPortfolioTimeframe] = useState("DAY");
  const [pnl, setPnl] = useState<OsWalletPnl | null>(null);
  const [shelves, setShelves] = useState<OsProfileShelf[]>([]);

  // Load account profile
  useEffect(() => {
    const load = async () => {
      setAccountLoading(true);
      setAccountError("");
      try {
        const r = await fetch(`/api/opensea/Accounts/${encodeURIComponent(address)}`, { credentials: "include" });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          if (r.status === 404) setAccountError("Account not found in cache. Use Sync to fetch from OpenSea.");
          else setAccountError(`Error ${r.status}: ${d.message ?? d.error ?? ""}`);
          return;
        }
        setAccount(d.account ?? d);
      } catch (e) {
        setAccountError(String(e));
      } finally {
        setAccountLoading(false);
      }
    };
    load();
  }, [address]);

  // Auto-load first tab once account is available
  useEffect(() => {
    if (account && !loadedTabs.has("NFTs")) {
      loadTab("NFTs");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  // Reload Portfolio when timeframe changes (only if already loaded)
  useEffect(() => {
    if (loadedTabs.has("Portfolio") && activeTab === "Portfolio") {
      loadTab("Portfolio", portfolioTimeframe);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioTimeframe]);

  const loadTab = useCallback(async (tab: TabName, tfOverride?: string) => {
    setTabError("");
    setTabLoading(true);
    try {
      let url = "";
      switch (tab) {
        case "NFTs":
          url = `/api/opensea/Nfts/account/${encodeURIComponent(address)}`;
          break;
        case "Collections":
          url = `/api/opensea/Accounts/${encodeURIComponent(address)}/collections`;
          break;
        case "Listings":
          url = `/api/opensea/Accounts/${encodeURIComponent(address)}/listings`;
          break;
        case "Offers Received":
          url = `/api/opensea/Accounts/${encodeURIComponent(address)}/offers-received`;
          break;
        case "Offers Made":
          url = `/api/opensea/Accounts/${encodeURIComponent(address)}/offers-made`;
          break;
        case "Events":
          url = `/api/opensea/Events/account/${encodeURIComponent(address)}`;
          break;
        case "Portfolio":
          url = `/api/opensea/Accounts/${encodeURIComponent(address)}/portfolio?timeframe=${tfOverride ?? portfolioTimeframe}`;
          break;
        case "P&L":
          url = `/api/opensea/Accounts/${encodeURIComponent(address)}/pnl`;
          break;
        case "Shelves":
          url = `/api/opensea/Profile/shelves?address=${encodeURIComponent(address)}`;
          break;
      }

      const r = await fetch(url, { credentials: "include" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setTabError(`Error ${r.status}: ${d.message ?? d.error ?? ""}`); return; }

      const rows = Array.isArray(d) ? d : d.data ?? d.listings ?? d.offers ?? d.collections ?? d.events ?? d.nfts ?? [];
      const nextCursor = d.next ?? null;

      switch (tab) {
        case "NFTs":         setNfts(rows); setNftsNext(nextCursor); break;
        case "Collections":  setCollections(rows); break;
        case "Listings":     setListings(rows); break;
        case "Offers Received": setOffersReceived(rows); break;
        case "Offers Made":  setOffersMade(rows); break;
        case "Events":       setEvents(rows); setEventsNext(nextCursor); break;
        case "Portfolio":    setPortfolio(d); break;
        case "P&L":          setPnl(d.realizedPnlUsd !== undefined ? d : null); break;
        case "Shelves":      setShelves(Array.isArray(d) ? d : d.shelves ?? []); break;
      }
      setLoadedTabs(prev => new Set([...prev, tab]));
    } catch (e) {
      setTabError(String(e));
    } finally {
      setTabLoading(false);
    }
  }, [address, portfolioTimeframe]);

  const switchTab = (tab: TabName) => {
    setActiveTab(tab);
    if (!loadedTabs.has(tab)) loadTab(tab);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg("");
    setAccountError("");
    try {
      const r = await fetch(
        `/api/opensea/Accounts/${encodeURIComponent(address)}/sync`,
        { method: "POST", credentials: "include" }
      );
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setAccountError(`Sync error ${r.status}: ${d.message ?? d.error ?? ""}`); return; }
      setSyncMsg("Synced from OpenSea");
      const acc: OSAccount = d.account ?? d;
      if (acc?.address) setAccount(acc);
    } catch (e) {
      setAccountError(String(e));
    } finally {
      setSyncing(false);
    }
  };

  const loadMoreNfts = async () => {
    if (!nftsNext || nftsLoadingMore) return;
    setNftsLoadingMore(true);
    try {
      const url = `/api/opensea/Nfts/account/${encodeURIComponent(address)}?next=${encodeURIComponent(nftsNext)}`;
      const r = await fetch(url, { credentials: "include" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return;
      const rows = d.data ?? [];
      setNfts(prev => [...prev, ...rows]);
      setNftsNext(d.next ?? null);
    } finally {
      setNftsLoadingMore(false);
    }
  };

  const loadMoreEvents = async () => {
    if (!eventsNext || eventsLoadingMore) return;
    setEventsLoadingMore(true);
    try {
      const url = `/api/opensea/Events/account/${encodeURIComponent(address)}?next=${encodeURIComponent(eventsNext)}`;
      const r = await fetch(url, { credentials: "include" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return;
      const rows = d.data ?? d.events ?? [];
      setEvents(prev => [...prev, ...rows]);
      setEventsNext(d.next ?? null);
    } finally {
      setEventsLoadingMore(false);
    }
  };

  const isTabLoading = (tab: TabName) => tabLoading && activeTab === tab;

  const handlePortfolioTimeframeChange = (tf: string) => {
    setPortfolioTimeframe(tf);
    // useEffect will trigger reload when portfolioTimeframe state updates
  };

  return (
    <div className="p-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={() => router.push("/admin/opensea/accounts")}
          className="flex items-center gap-1 text-xs font-medium transition-colors"
          style={{ color: "#9bafc5" }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Accounts
        </button>
        <span style={{ color: "#e4e7ed" }}>/</span>
        <span className="font-mono text-xs font-medium" style={{ color: "#24315f" }}>
          {address.length > 18 ? `${address.slice(0, 10)}…${address.slice(-4)}` : address}
        </span>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-lg p-5 mb-4" style={{ border: "1px solid #e4e7ed" }}>
        {accountLoading && (
          <div className="flex justify-center py-8"><Spinner /></div>
        )}
        {accountError && (
          <div className="space-y-3">
            <p className="text-xs px-3 py-2 rounded" style={{ background: "#fee2e2", color: "#dc2626" }}>
              {accountError}
            </p>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold text-white"
              style={{ background: "#41afeb", opacity: syncing ? 0.65 : 1 }}
            >
              {syncing ? <Spinner size={3} /> : null}
              Sync from OpenSea
            </button>
          </div>
        )}
        {account && !accountLoading && (
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <ProfileCard account={account} />
            <div className="flex flex-col items-end gap-2">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold text-white transition-opacity"
                style={{ background: "#41afeb", opacity: syncing ? 0.65 : 1 }}
              >
                {syncing ? <Spinner size={3} /> : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                Sync
              </button>
              {syncMsg && (
                <span className="text-[10px] font-semibold" style={{ color: "#16a34a" }}>{syncMsg}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tabs + content */}
      {(account || !accountLoading) && (
        <div className="bg-white rounded-lg" style={{ border: "1px solid #e4e7ed" }}>
          {/* Tab bar */}
          <div className="flex items-center gap-0 overflow-x-auto" style={{ borderBottom: "1px solid #e4e7ed" }}>
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => switchTab(tab)}
                className="px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors relative"
                style={activeTab === tab
                  ? { color: "#24315f", borderBottom: "2px solid #24315f", marginBottom: -1 }
                  : { color: "#9bafc5", borderBottom: "2px solid transparent", marginBottom: -1 }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab error */}
          {tabError && (
            <div className="px-4 py-3 text-xs" style={{ color: "#dc2626", background: "#fee2e2" }}>{tabError}</div>
          )}

          {/* Tab content */}
          <div className="overflow-x-auto">
            {activeTab === "NFTs" && (
              <NftsTab
                items={nfts}
                loading={isTabLoading("NFTs")}
                next={nftsNext}
                onLoadMore={loadMoreNfts}
                loadingMore={nftsLoadingMore}
              />
            )}
            {activeTab === "Collections" && (
              <CollectionsTab items={collections} loading={isTabLoading("Collections")} />
            )}
            {activeTab === "Listings" && (
              <ListingsTab items={listings} loading={isTabLoading("Listings")} />
            )}
            {activeTab === "Offers Received" && (
              <OffersTab items={offersReceived} loading={isTabLoading("Offers Received")} label="offers received" />
            )}
            {activeTab === "Offers Made" && (
              <OffersTab items={offersMade} loading={isTabLoading("Offers Made")} label="offers made" />
            )}
            {activeTab === "Events" && (
              <EventsTab
                items={events}
                loading={isTabLoading("Events")}
                next={eventsNext}
                onLoadMore={loadMoreEvents}
                loadingMore={eventsLoadingMore}
              />
            )}
            {activeTab === "Portfolio" && (
              <PortfolioTab
                stats={portfolio}
                loading={isTabLoading("Portfolio")}
                timeframe={portfolioTimeframe}
                onTimeframeChange={handlePortfolioTimeframeChange}
              />
            )}
            {activeTab === "P&L" && (
              <PnlTab pnl={pnl} loading={isTabLoading("P&L")} />
            )}
            {activeTab === "Shelves" && (
              <ShelvesTab shelves={shelves} loading={isTabLoading("Shelves")} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
