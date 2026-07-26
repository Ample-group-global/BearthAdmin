"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Wave {
  waveNumber:          number;
  name:                string;
  status:              string;  // upcoming | active | ended | closed
  quantity:            number;
  soldCount:           number;
  priceEth:            string | null;
  scheduledStart:      string | null;
  scheduledEnd:        string | null;
  waveClosed:          boolean;
  closeAction:         string | null;  // treasury | forfeit | burn | null
  treasuryRecipient:   string | null;
  treasuryMintedCount: number;
  saleMethod:          string | null;
}

interface TreasuryNFT {
  token_id:    number;
  origin_wave: number;
  wave_name:   string;
  rarity_tier: string | null;
  owner_wallet: string;
  minted_at:   string;
}

type TxState = { pending: boolean; hash: string; error: string; success: string };
const TX0: TxState = { pending: false, hash: "", error: "", success: "" };

const WAVE_NAMES = ["", "Genesis", "Pioneer", "Voyager", "Explorer", "Adventurer", "Champion", "Legend"];
const WAVE_PRICES = ["", "Free", "0.0303 ETH", "0.0303 ETH", "0.0606 ETH", "0.0909 ETH", "0.1515 ETH", "0.2424 ETH"];
const WAVE_QTYS   = [0, 303, 303, 606, 909, 1515, 2424, 3939];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function waveStatus(w: Wave): "upcoming" | "active" | "ended" | "closed" {
  if (w.waveClosed) return "closed";
  const now = Date.now();
  if (!w.scheduledStart) return "upcoming";
  const start = new Date(w.scheduledStart).getTime();
  const end   = w.scheduledEnd ? new Date(w.scheduledEnd).getTime() : Infinity;
  if (now < start) return "upcoming";
  if (now <= end)  return "active";
  return "ended";
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    upcoming: "bg-slate-100 text-slate-600",
    active:   "bg-emerald-100 text-emerald-700",
    ended:    "bg-amber-100 text-amber-700",
    closed:   "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg[status] ?? "bg-slate-100 text-slate-500"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function TxStatus({ tx, onClear }: { tx: TxState; onClear: () => void }) {
  if (!tx.pending && !tx.hash && !tx.error && !tx.success) return null;
  return (
    <div className={`mt-3 p-3 rounded-lg text-sm flex items-start gap-2.5 ${
      tx.error   ? "bg-red-50 border border-red-200 text-red-700"
    : tx.success ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
    :              "bg-blue-50 border border-blue-200 text-blue-700"
    }`}>
      {tx.pending && <span className="w-4 h-4 mt-0.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        {tx.pending && <p className="font-medium">Transaction pending…</p>}
        {tx.hash    && <p className="font-mono text-xs break-all">TX: {tx.hash}</p>}
        {tx.error   && <p>{tx.error}</p>}
        {tx.success && <p className="font-medium">{tx.success}</p>}
      </div>
      {(tx.error || tx.success) && (
        <button onClick={onClear} className="text-xs opacity-60 hover:opacity-100 flex-shrink-0">✕</button>
      )}
    </div>
  );
}

// ── Wave Card ─────────────────────────────────────────────────────────────────

function WaveCard({
  wave, onRefresh,
}: {
  wave: Wave;
  onRefresh: () => void;
}) {
  const [recipientInput, setRecipientInput] = useState("");
  const [txClose,   setTxClose]   = useState(TX0);
  const [txForfeit, setTxForfeit] = useState(TX0);
  const [showForfeit, setShowForfeit] = useState(false);

  const status    = waveStatus(wave);
  const unsold    = (wave.quantity ?? WAVE_QTYS[wave.waveNumber]) - wave.soldCount;
  const soldPct   = wave.quantity > 0 ? Math.round((wave.soldCount / wave.quantity) * 100) : 0;
  const ETH_RE    = /^0x[0-9a-fA-F]{40}$/;

  const doTreasuryClose = async () => {
    const recipient = recipientInput.trim() || null;
    if (recipient && !ETH_RE.test(recipient)) {
      setTxClose({ ...TX0, error: "Enter a valid Ethereum address (0x + 40 hex chars)" });
      return;
    }
    setTxClose({ pending: true, hash: "", error: "", success: "" });
    try {
      const res = await fetch(`/api/nft-sell/waves/${wave.waveNumber}/treasury-close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(recipient ? { recipient } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setTxClose({ pending: false, hash: data.txHash ?? "", error: "", success: `Wave ${wave.waveNumber} closed — ${unsold} NFT${unsold !== 1 ? "s" : ""} sent to treasury wallet` });
      setTimeout(onRefresh, 3000);
    } catch (e: unknown) {
      setTxClose({ pending: false, hash: "", error: e instanceof Error ? e.message : String(e), success: "" });
    }
  };

  const doForfeit = async () => {
    setTxForfeit({ pending: true, hash: "", error: "", success: "" });
    try {
      const res = await fetch(`/api/nft-sell/waves/${wave.waveNumber}/forfeit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setTxForfeit({ pending: false, hash: data.txHash ?? "", error: "", success: `Wave ${wave.waveNumber} forfeited — ${unsold} unsold slot${unsold !== 1 ? "s" : ""} discarded` });
      setShowForfeit(false);
      setTimeout(onRefresh, 3000);
    } catch (e: unknown) {
      setTxForfeit({ pending: false, hash: "", error: e instanceof Error ? e.message : String(e), success: "" });
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Wave header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
            W{wave.waveNumber}
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">{WAVE_NAMES[wave.waveNumber] ?? `Wave ${wave.waveNumber}`}</p>
            <p className="text-xs text-slate-400">{wave.waveNumber === 1 ? "Free Mint" : WAVE_PRICES[wave.waveNumber] ?? "Paid Mint"}</p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Stats */}
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-slate-50 rounded-xl p-2.5">
            <p className="text-xs text-slate-500 mb-0.5">Allocated</p>
            <p className="font-bold text-slate-900 text-sm">{wave.quantity ?? WAVE_QTYS[wave.waveNumber]}</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-2.5">
            <p className="text-xs text-slate-500 mb-0.5">Sold</p>
            <p className="font-bold text-emerald-700 text-sm">{wave.soldCount}</p>
          </div>
          <div className={`rounded-xl p-2.5 ${unsold > 0 ? "bg-amber-50" : "bg-slate-50"}`}>
            <p className="text-xs text-slate-500 mb-0.5">Unsold</p>
            <p className={`font-bold text-sm ${unsold > 0 ? "text-amber-700" : "text-slate-500"}`}>{unsold}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Progress</span>
            <span>{soldPct}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all" style={{ width: `${soldPct}%` }} />
          </div>
        </div>

        {/* Schedule */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-slate-400">Opens</p>
            <p className="text-slate-700 font-medium">{fmtDate(wave.scheduledStart)}</p>
          </div>
          <div>
            <p className="text-slate-400">Closes</p>
            <p className="text-slate-700 font-medium">{fmtDate(wave.scheduledEnd)}</p>
          </div>
        </div>

        {/* Closed info */}
        {status === "closed" && wave.closeAction && (
          <div className={`rounded-xl p-3 text-xs ${wave.closeAction === "treasury" ? "bg-indigo-50 border border-indigo-100" : "bg-slate-50 border border-slate-200"}`}>
            {wave.closeAction === "treasury" ? (
              <>
                <p className="font-semibold text-indigo-800 mb-1">Treasury Close</p>
                <p className="text-indigo-600">{wave.treasuryMintedCount} NFT{wave.treasuryMintedCount !== 1 ? "s" : ""} sent to:</p>
                <p className="font-mono text-indigo-700 break-all mt-0.5">{wave.treasuryRecipient ?? "—"}</p>
              </>
            ) : (
              <p className="text-slate-500">Closed — unsold supply forfeited ({wave.closeAction})</p>
            )}
          </div>
        )}

        {/* Treasury Close action — only for ended waves with unsold supply */}
        {status === "ended" && unsold > 0 && (
          <div className="border border-indigo-200 rounded-xl p-3 space-y-3 bg-indigo-50/40">
            <div>
              <p className="text-xs font-semibold text-indigo-900">Close Wave — Send Unsold to Wallet</p>
              <p className="text-xs text-indigo-600 mt-0.5">
                {unsold} unsold NFT{unsold !== 1 ? "s" : ""} will be minted directly to the recipient wallet.
                Owner can sell them later on any platform (OpenSea, own website, OTC).
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Recipient Wallet <span className="text-slate-400 font-normal">(leave blank to use contract treasury wallet)</span>
              </label>
              <input
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                placeholder="0x… or leave blank for default treasury wallet"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <button
              onClick={doTreasuryClose}
              disabled={txClose.pending}
              className="w-full py-2 px-4 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors"
            >
              {txClose.pending ? "Sending transaction…" : `Close & Send ${unsold} NFT${unsold !== 1 ? "s" : ""} to Wallet`}
            </button>
            <TxStatus tx={txClose} onClear={() => setTxClose(TX0)} />

            {/* Forfeit option */}
            {!showForfeit ? (
              <button
                onClick={() => setShowForfeit(true)}
                className="w-full py-1.5 text-xs text-red-500 hover:text-red-700 underline"
              >
                Or permanently discard unsold supply (forfeit — no minting)
              </button>
            ) : (
              <div className="border border-red-200 rounded-lg p-3 bg-red-50 space-y-2">
                <p className="text-xs font-semibold text-red-800">Confirm Forfeit</p>
                <p className="text-xs text-red-600">This discards {unsold} unsold slot{unsold !== 1 ? "s" : ""} permanently. No tokens will be minted. This cannot be undone.</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowForfeit(false)} className="flex-1 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                    Cancel
                  </button>
                  <button
                    onClick={doForfeit}
                    disabled={txForfeit.pending}
                    className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                  >
                    {txForfeit.pending ? "Sending…" : "Confirm Forfeit"}
                  </button>
                </div>
                <TxStatus tx={txForfeit} onClear={() => setTxForfeit(TX0)} />
              </div>
            )}
          </div>
        )}

        {/* Ended with no unsold */}
        {status === "ended" && unsold === 0 && (
          <div className="rounded-xl p-3 bg-emerald-50 border border-emerald-100 text-xs text-emerald-700 font-medium">
            Fully sold out — no unsold tokens to close
          </div>
        )}
      </div>
    </div>
  );
}

// ── Treasury NFTs Panel ───────────────────────────────────────────────────────

function TreasuryPanel() {
  const [nfts, setNfts]       = useState<TreasuryNFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    fetch("/api/nft-sell/waves/treasury-nfts", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setNfts(d.nfts ?? []))
      .catch(() => setError("Could not load treasury NFTs"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-sm text-slate-400 py-4 text-center">Loading treasury NFTs…</div>;
  if (error)   return <div className="text-sm text-red-600 py-4 text-center">{error}</div>;
  if (!nfts.length) return (
    <div className="text-center py-8 text-slate-400">
      <p className="text-2xl mb-2">🏦</p>
      <p className="text-sm">No treasury NFTs yet. Unsold tokens appear here after a treasury close.</p>
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-400 border-b border-slate-100">
            <th className="text-left pb-3 font-medium">Token ID</th>
            <th className="text-left pb-3 font-medium">Origin Wave</th>
            <th className="text-left pb-3 font-medium">Rarity</th>
            <th className="text-left pb-3 font-medium">Holder Wallet</th>
            <th className="text-left pb-3 font-medium">Minted At</th>
            <th className="text-left pb-3 font-medium">Sell Options</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {nfts.map((nft) => (
            <tr key={nft.token_id} className="hover:bg-slate-50">
              <td className="py-2.5 font-mono font-medium text-slate-800">#{nft.token_id}</td>
              <td className="py-2.5">
                <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                  W{nft.origin_wave} {WAVE_NAMES[nft.origin_wave] ?? ""}
                </span>
              </td>
              <td className="py-2.5">
                {nft.rarity_tier ? (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    nft.rarity_tier === "Legendary" ? "bg-yellow-100 text-yellow-700"
                  : nft.rarity_tier === "Epic"      ? "bg-purple-100 text-purple-700"
                  : nft.rarity_tier === "Rare"      ? "bg-blue-100 text-blue-700"
                  :                                   "bg-slate-100 text-slate-600"
                  }`}>{nft.rarity_tier}</span>
                ) : <span className="text-slate-300 text-xs">—</span>}
              </td>
              <td className="py-2.5 font-mono text-xs text-slate-500 max-w-[180px] truncate">{nft.owner_wallet}</td>
              <td className="py-2.5 text-xs text-slate-500">{fmtDate(nft.minted_at)}</td>
              <td className="py-2.5">
                <div className="flex items-center gap-1.5">
                  <a
                    href={`https://opensea.io/assets/ethereum/${nft.owner_wallet}/${nft.token_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2 py-1 text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg"
                  >
                    OpenSea
                  </a>
                  <a
                    href={`/dashboard/nfts?token=${nft.token_id}`}
                    className="px-2 py-1 text-xs font-medium bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    OTC / Details
                  </a>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WavesPage() {
  const [waves,   setWaves]   = useState<Wave[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [tab,     setTab]     = useState<"waves" | "treasury">("waves");

  const fetchWaves = useCallback(async () => {
    setError("");
    try {
      const res  = await fetch("/api/nft-sell/waves", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load waves");
      setWaves(data.waves ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWaves(); }, [fetchWaves]);

  const endedWithUnsold = waves.filter((w) => waveStatus(w) === "ended" && (w.quantity - w.soldCount) > 0).length;
  const treasuryHeld    = waves.filter((w) => w.closeAction === "treasury").reduce((s, w) => s + w.treasuryMintedCount, 0);

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Wave Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage all 7 NFT waves — close ended waves to send unsold tokens to owner wallet
          </p>
        </div>
        <button
          onClick={fetchWaves}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
        >
          <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Waves",      value: "7",                      color: "text-slate-900" },
          { label: "Active Now",       value: String(waves.filter(w => waveStatus(w) === "active").length),  color: "text-emerald-700" },
          { label: "Needs Closing",    value: String(endedWithUnsold),   color: endedWithUnsold > 0 ? "text-amber-700" : "text-slate-500" },
          { label: "Treasury Held",    value: String(treasuryHeld),      color: treasuryHeld > 0 ? "text-indigo-700" : "text-slate-500" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
            <p className="text-xs text-slate-400 mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {[
          { id: "waves",    label: "All Waves" },
          { id: "treasury", label: `Treasury NFTs${treasuryHeld > 0 ? ` (${treasuryHeld})` : ""}` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as "waves" | "treasury")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "waves" && (
        <>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-200 h-64 animate-pulse" />
              ))}
            </div>
          ) : waves.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-2xl mb-2">🌊</p>
              <p className="text-sm">No wave data loaded. Check that BearthApi is running.</p>
            </div>
          ) : (
            <>
              {endedWithUnsold > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {endedWithUnsold} wave{endedWithUnsold !== 1 ? "s have" : " has"} ended with unsold tokens — use Treasury Close to send them to the owner wallet.
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {waves.map((w) => (
                  <WaveCard key={w.waveNumber} wave={w} onRefresh={fetchWaves} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {tab === "treasury" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-800">Treasury-Held NFTs</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Tokens minted to owner wallet after treasury close. Owner can list on OpenSea,
              create OTC deals, or sell through the website at any time.
            </p>
          </div>
          <TreasuryPanel />
        </div>
      )}
    </div>
  );
}
