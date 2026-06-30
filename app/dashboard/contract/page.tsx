"use client";

import { useState, useEffect, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ethers } from "ethers";
import { useChain } from "@/lib/ChainContext";
import BearthNFTArtifact from "@/lib/BearthNFT.abi.json";
import { ipfsToGateway } from "@/lib/ipfs";

type Tab = "phase" | "whitelist" | "mint" | "reveal" | "financial" | "advanced";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "phase",     label: "Phase & Timing",    icon: "🔄" },
  { id: "whitelist", label: "Whitelist Root",     icon: "🌳" },
  { id: "mint",      label: "Mint Settings",      icon: "⚙️" },
  { id: "reveal",    label: "Reveal & URIs",      icon: "🎨" },
  { id: "financial", label: "Financial",          icon: "💰" },
  { id: "advanced",  label: "Advanced",           icon: "🔧" },
];

const PHASE_NAMES = ["0 — None", "1 — Whitelist", "2 — Public Mint", "3 — Paid Mint"];
const PHASE_COLOR = ["bg-slate-100 text-slate-600", "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700"];

interface TxState {
  pending: boolean;
  hash: string;
  error: string;
  success: string;
}

const TX0: TxState = { pending: false, hash: "", error: "", success: "" };

function TxStatus({ tx, onClear }: { tx: TxState; onClear: () => void }) {
  if (!tx.pending && !tx.hash && !tx.error && !tx.success) return null;
  return (
    <div className={`mt-3 p-3 rounded-lg text-sm flex items-start gap-2.5 ${tx.error ? "bg-red-50 border border-red-200 text-red-700" : tx.success ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-blue-50 border border-blue-200 text-blue-700"}`}>
      {tx.pending && <span className="w-4 h-4 mt-0.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin flex-shrink-0" />}
      <div className="min-w-0 flex-1">
        {tx.pending && <p className="font-medium">Transaction pending…</p>}
        {tx.hash && <p className="font-mono text-xs break-all">TX: {tx.hash}</p>}
        {tx.error && <p>{tx.error}</p>}
        {tx.success && <p className="font-medium">{tx.success}</p>}
      </div>
      {(tx.error || tx.success) && (
        <button onClick={onClear} className="flex-shrink-0 text-xs opacity-60 hover:opacity-100">✕</button>
      )}
    </div>
  );
}

function SectionCard({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {note && <p className="text-xs text-slate-400 mt-0.5">{note}</p>}
      </div>
      {children}
    </div>
  );
}

function InputRow({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      {note && <p className="text-xs text-slate-400 mb-1.5">{note}</p>}
      {children}
    </div>
  );
}

function ActionBtn({ onClick, loading, disabled, danger, children }: {
  onClick: () => void; loading?: boolean; disabled?: boolean; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={`px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        danger
          ? "bg-red-600 hover:bg-red-700 text-white"
          : "bg-blue-600 hover:bg-blue-700 text-white"
      }`}
    >
      {loading ? "Sending…" : children}
    </button>
  );
}

export default function ContractPage() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { activeChain } = useChain();

  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [readContract, setReadContract] = useState<ethers.Contract | null>(null);
  const [readProvider, setReadProvider] = useState<ethers.AbstractProvider | null>(null);

  const [tab, setTab] = useState<Tab>("phase");

  // ── Live contract state ───────────────────────────────────────────────────
  const [livePhase, setLivePhase] = useState<number | null>(null);
  const [liveSbt, setLiveSbt] = useState<boolean | null>(null);
  const [liveRevealed, setLiveRevealed] = useState<boolean | null>(null);
  const [liveSupply, setLiveSupply] = useState<{ minted: number; max: number } | null>(null);
  const [liveRoot, setLiveRoot] = useState("");
  const [liveWlStart, setLiveWlStart] = useState<number | null>(null);
  const [liveWlEnd, setLiveWlEnd] = useState<number | null>(null);
  const [liveBalance, setLiveBalance] = useState("");
  const [liveLimits, setLiveLimits] = useState<{ l1: number; l2: number } | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState("");

  // ── Form inputs ───────────────────────────────────────────────────────────
  const [phaseInput, setPhaseInput] = useState("0");
  const [wlStartInput, setWlStartInput] = useState("");
  const [wlEndInput, setWlEndInput] = useState("");
  const [rootInput, setRootInput] = useState("");
  const [backendRoot, setBackendRoot] = useState("");
  const [limit1, setLimit1] = useState("1");
  const [limit2, setLimit2] = useState("3");
  const [sbtInput, setSbtInput] = useState(false);
  const [revealUri, setRevealUri] = useState("");
  const [checkTokenId, setCheckTokenId] = useState("");
  const [checkMeta, setCheckMeta] = useState<any>(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [withdrawTo, setWithdrawTo] = useState("");
  const [royaltyReceiver, setRoyaltyReceiver] = useState("");
  const [royaltyBps, setRoyaltyBps] = useState("500");
  const [pauseAccountAddr, setPauseAccountAddr] = useState("");
  const [unpauseAccountAddr, setUnpauseAccountAddr] = useState("");
  const [emergencyTokenId, setEmergencyTokenId] = useState("");
  const [emergencyFrom, setEmergencyFrom] = useState("");
  const [emergencyTo, setEmergencyTo] = useState("");
  const [emergencyReason, setEmergencyReason] = useState("");
  const [batchMintTo, setBatchMintTo] = useState("");
  const [batchMintAmt, setBatchMintAmt] = useState("1");

  // ── Tx states (one per action group) ─────────────────────────────────────
  const [txPhase, setTxPhase] = useState(TX0);
  const [txTimes, setTxTimes] = useState(TX0);
  const [txRoot, setTxRoot] = useState(TX0);
  const [txLimits, setTxLimits] = useState(TX0);
  const [txSbt, setTxSbt] = useState(TX0);
  const [txReveal, setTxReveal] = useState(TX0);
  const [txWithdraw, setTxWithdraw] = useState(TX0);
  const [txRoyalty, setTxRoyalty] = useState(TX0);
  const [txPause, setTxPause] = useState(TX0);
  const [txPauseAcc, setTxPauseAcc] = useState(TX0);
  const [txEmergency, setTxEmergency] = useState(TX0);
  const [txBatch, setTxBatch] = useState(TX0);

  // ── Provider / signer / contract init ────────────────────────────────────
  useEffect(() => {
    const wallet = wallets?.[0];
    if (!authenticated || !wallet) return;
    (async () => {
      try {
        await wallet.switchChain(activeChain.chainId);
        const eip1193 = await wallet.getEthereumProvider();
        const p = new ethers.BrowserProvider(eip1193);
        const s = await p.getSigner();
        setContract(new ethers.Contract(activeChain.contractAddress, BearthNFTArtifact.abi, s));
      } catch (e) { console.error(e); }
    })();
  }, [authenticated, wallets, activeChain]);

  useEffect(() => {
    const wallet = wallets?.[0];
    if (wallet && authenticated) {
      // read via wallet provider when connected
      wallet.getEthereumProvider().then((eip1193) => {
        const p = new ethers.BrowserProvider(eip1193);
        setReadProvider(p);
        setReadContract(new ethers.Contract(activeChain.contractAddress, BearthNFTArtifact.abi, p));
      }).catch(() => {
        const p = new ethers.JsonRpcProvider(activeChain.rpcUrl);
        setReadProvider(p);
        setReadContract(new ethers.Contract(activeChain.contractAddress, BearthNFTArtifact.abi, p));
      });
    } else {
      const p = new ethers.JsonRpcProvider(activeChain.rpcUrl);
      setReadProvider(p);
      setReadContract(new ethers.Contract(activeChain.contractAddress, BearthNFTArtifact.abi, p));
    }
  }, [activeChain, authenticated, wallets]);

  // ── Fetch live state ──────────────────────────────────────────────────────
  const fetchLive = useCallback(async () => {
    if (!readContract || !readProvider) return;
    setLiveLoading(true);
    setLiveError("");
    try {
      const [phase, sbt, data, root, wlStart, wlEnd, balance] = await Promise.all([
        readContract.phase(),
        readContract.sbt(),
        readContract.getData(),
        readContract.root(),
        readContract.wlStart(),
        readContract.wlEnd(),
        readProvider.getBalance(activeChain.contractAddress),
      ]);
      setLivePhase(Number(phase));
      setLiveSbt(Boolean(sbt));
      setLiveSupply({ minted: Number(data[1]), max: Number(data[2]) });
      setLiveRevealed(Boolean(data[5]));
      setLiveLimits({ l1: Number(data[6]), l2: Number(data[7]) });
      setLiveRoot(root);
      setLiveWlStart(Number(wlStart));
      setLiveWlEnd(Number(wlEnd));
      setLiveBalance(parseFloat(ethers.formatEther(balance)).toFixed(4));
      // Pre-fill sbt toggle from on-chain
      setSbtInput(Boolean(sbt));
    } catch (e: any) {
      setLiveError("Could not read contract: " + (e?.shortMessage || e?.message || String(e)));
    } finally {
      setLiveLoading(false);
    }

    // Backend root
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";
      const res = await fetch(`${API_BASE}/api/whitelist/merkle-root`, { credentials: "include" });
      if (res.ok) setBackendRoot((await res.json()).root ?? "");
    } catch { setBackendRoot(""); }
  }, [readContract, readProvider, activeChain]);

  useEffect(() => { fetchLive(); }, [fetchLive]);

  // Auto-fill WL times if empty
  useEffect(() => {
    if (!readProvider || wlStartInput || wlEndInput) return;
    readProvider.getBlock("latest").then((b) => {
      if (!b) return;
      const start = b.timestamp + 60;
      setWlStartInput(String(start));
      setWlEndInput(String(start + 7 * 24 * 3600));
    }).catch(() => {});
  }, [readProvider, wlStartInput, wlEndInput]);

  // ── Tx helper ─────────────────────────────────────────────────────────────
  const exec = async (
    set: (s: TxState) => void,
    call: Promise<ethers.ContractTransactionResponse>,
    successMsg: string
  ) => {
    set({ pending: true, hash: "", error: "", success: "" });
    try {
      const tx = await call;
      set({ pending: true, hash: tx.hash, error: "", success: "" });
      await tx.wait();
      set({ pending: false, hash: tx.hash, error: "", success: successMsg });
      fetchLive();
    } catch (e: any) {
      set({ pending: false, hash: "", error: e?.reason || e?.shortMessage || e?.message || String(e), success: "" });
    }
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSetPhase = () => contract && exec(setTxPhase, contract.setPhase(BigInt(phaseInput)), `Phase set to ${PHASE_NAMES[Number(phaseInput)]}`);
  const handleSetTimes = () => contract && exec(setTxTimes, contract.setWLTimes(BigInt(wlStartInput), BigInt(wlEndInput)), "Whitelist window updated");
  // setWL(root, start, end) — sets root + times in one tx
  const handleSetWL = () => contract && exec(setTxRoot, contract.setWL(rootInput.trim(), BigInt(wlStartInput), BigInt(wlEndInput)), "Root + times set in one transaction");
  const handlePushRoot = () => contract && exec(setTxRoot, contract.setWhitelist(rootInput.trim()), "Merkle root pushed on-chain");
  const handleSetLimits = () => contract && exec(setTxLimits, contract.setLimits(BigInt(limit1), BigInt(limit2)), "Mint limits updated");
  const handleSetSbt = () => contract && exec(setTxSbt, contract.setSBT(sbtInput), `SBT mode ${sbtInput ? "enabled" : "disabled"}`);
  const handleReveal = () => contract && exec(setTxReveal, contract.reveal(revealUri.trim()), "NFT artwork revealed");
  const handleWithdraw = () => contract && exec(setTxWithdraw, contract.withdraw(withdrawTo.trim()), "ETH withdrawn");
  const handleSetRoyalty = () => contract && exec(setTxRoyalty, contract.setRoyalty(royaltyReceiver.trim(), BigInt(royaltyBps)), "Royalty updated");
  const handlePause = () => contract && exec(setTxPause, contract.pause(), "Contract paused");
  const handleUnpause = () => contract && exec(setTxPause, contract.unpause(), "Contract unpaused");
  const handlePauseAccount = () => contract && exec(setTxPauseAcc, contract.pauseAccount(pauseAccountAddr.trim()), "Account paused");
  const handleUnpauseAccount = () => contract && exec(setTxPauseAcc, contract.unpauseAccount(unpauseAccountAddr.trim()), "Account unpaused");
  const handleEmergencyTransfer = () => contract && exec(setTxEmergency,
    contract.emergencyTransfer(BigInt(emergencyTokenId), emergencyFrom.trim(), emergencyTo.trim(), emergencyReason.trim()),
    "Emergency transfer executed"
  );
  const handleBatchMint = () => contract && exec(setTxBatch, contract.batchMint(batchMintTo.trim(), BigInt(batchMintAmt)), `Minted ${batchMintAmt} NFTs`);

  const handleCheckMetadata = async () => {
    if (!contract || !checkTokenId) return;
    setCheckLoading(true); setCheckError(""); setCheckMeta(null);
    try {
      const uri: string = await contract.tokenURI(BigInt(checkTokenId));
      const httpUri = ipfsToGateway(uri);
      const res = await fetch(httpUri);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCheckMeta(await res.json());
    } catch (e: any) { setCheckError(e?.message || String(e)); }
    finally { setCheckLoading(false); }
  };

  const fmt = (ts: number | null) =>
    ts && ts > 0 ? new Date(ts * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Not set";

  const walletConnected = authenticated && wallets.length > 0;

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Contract Operations</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {activeChain.name} ·{" "}
            <a
              href={`${activeChain.blockExplorer}/address/${activeChain.contractAddress}`}
              target="_blank" rel="noreferrer"
              className="font-mono text-blue-600 hover:underline"
            >
              {activeChain.contractAddress.slice(0, 10)}…{activeChain.contractAddress.slice(-8)}
            </a>
          </p>
        </div>
        <button
          onClick={fetchLive}
          disabled={liveLoading}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
        >
          <svg className={`w-3.5 h-3.5 ${liveLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Wallet not connected warning */}
      {!walletConnected && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-center gap-2.5">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Connect your wallet (top-right) to execute contract operations. Live stats load without a wallet.
        </div>
      )}

      {liveError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{liveError}</div>
      )}

      {/* Live Status Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          {
            label: "Phase",
            value: livePhase !== null ? PHASE_NAMES[livePhase] ?? `Phase ${livePhase}` : "—",
            badge: livePhase !== null ? PHASE_COLOR[livePhase] : "bg-slate-100 text-slate-600",
          },
          { label: "Minted", value: liveSupply ? `${liveSupply.minted} / ${liveSupply.max}` : "—" },
          { label: "SBT Mode", value: liveSbt !== null ? (liveSbt ? "Locked" : "Transferable") : "—" },
          { label: "Artwork", value: liveRevealed !== null ? (liveRevealed ? "Revealed" : "Blind Box") : "—" },
          { label: "WL Opens", value: fmt(liveWlStart) },
          { label: "WL Closes", value: fmt(liveWlEnd) },
          { label: "Balance", value: liveBalance ? `${liveBalance} ETH` : "—" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-xs font-bold break-words ${s.badge ? `inline-block px-1.5 py-0.5 rounded-md ${s.badge}` : "text-slate-900"}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Tab navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-1 flex overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
                tab === t.id
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-5">

          {/* ─── Phase & Timing ──────────────────────────────────────────── */}
          {tab === "phase" && (
            <>
              {/* Phase stepper */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[0, 1, 2, 3].map((p) => (
                  <div key={p} className={`flex-1 min-w-[90px] text-center py-3 px-2 rounded-xl border-2 text-xs font-bold transition-all ${
                    livePhase === p
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-slate-50 text-slate-400"
                  }`}>
                    {livePhase === p && <span className="block text-blue-400 text-[10px] mb-0.5">▶ Active</span>}
                    {["None", "Whitelist Mint", "Public Mint", "Paid Mint"][p]}
                  </div>
                ))}
              </div>

              <SectionCard title="Set Phase" note="Advancing the phase opens or closes minting for the corresponding group.">
                <InputRow label="New Phase">
                  <select
                    value={phaseInput}
                    onChange={(e) => setPhaseInput(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="0">0 — None (paused)</option>
                    <option value="1">1 — Whitelist Mint</option>
                    <option value="2">2 — Public Mint (free)</option>
                    <option value="3">3 — Paid Mint</option>
                  </select>
                </InputRow>
                <ActionBtn onClick={handleSetPhase} loading={txPhase.pending} disabled={!walletConnected}>
                  Set Phase
                </ActionBtn>
                <TxStatus tx={txPhase} onClear={() => setTxPhase(TX0)} />
              </SectionCard>

              <SectionCard title="Whitelist Time Window" note="Unix timestamps. The WL phase is only active between these two times.">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputRow label="WL Start (Unix timestamp)" note={wlStartInput ? `→ ${fmt(Number(wlStartInput))}` : undefined}>
                    <input
                      type="number"
                      value={wlStartInput}
                      onChange={(e) => setWlStartInput(e.target.value)}
                      placeholder="e.g. 1704067200"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </InputRow>
                  <InputRow label="WL End (Unix timestamp)" note={wlEndInput ? `→ ${fmt(Number(wlEndInput))}` : undefined}>
                    <input
                      type="number"
                      value={wlEndInput}
                      onChange={(e) => setWlEndInput(e.target.value)}
                      placeholder="e.g. 1704672000"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </InputRow>
                </div>
                <ActionBtn onClick={handleSetTimes} loading={txTimes.pending} disabled={!walletConnected}>
                  Set Times Only
                </ActionBtn>
                <TxStatus tx={txTimes} onClear={() => setTxTimes(TX0)} />
              </SectionCard>
            </>
          )}

          {/* ─── Whitelist Root ───────────────────────────────────────────── */}
          {tab === "whitelist" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-medium text-slate-500 mb-1.5">On-chain Root</p>
                  <p className="font-mono text-xs text-slate-800 break-all">{liveRoot || "Not set"}</p>
                </div>
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-medium text-slate-500 mb-1.5">Backend-reported Root</p>
                  <p className="font-mono text-xs text-slate-800 break-all">{backendRoot || "Not set"}</p>
                  {backendRoot && liveRoot && backendRoot.toLowerCase() === liveRoot.toLowerCase() && (
                    <span className="mt-1.5 inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      In sync with on-chain
                    </span>
                  )}
                  {backendRoot && liveRoot && backendRoot.toLowerCase() !== liveRoot.toLowerCase() && (
                    <span className="mt-1.5 inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                      ⚠ Differs from on-chain root
                    </span>
                  )}
                </div>
              </div>

              <SectionCard title="Root Input" note="After saving the whitelist, the backend computes this root. Copy it here to push on-chain.">
                <InputRow label="Merkle Root (bytes32)">
                  <div className="flex gap-2">
                    <input
                      value={rootInput}
                      onChange={(e) => setRootInput(e.target.value)}
                      placeholder="0x..."
                      className="flex-1 px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {backendRoot && (
                      <button
                        onClick={() => setRootInput(backendRoot)}
                        className="px-3 py-2.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 whitespace-nowrap"
                      >
                        Use Backend Root
                      </button>
                    )}
                  </div>
                </InputRow>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                    <p className="text-xs font-semibold text-slate-700">Option A — Root only</p>
                    <p className="text-xs text-slate-400">Calls <code className="bg-slate-200 px-1 rounded">setWhitelist(root)</code> — push the root now, set times separately.</p>
                    <ActionBtn onClick={handlePushRoot} loading={txRoot.pending} disabled={!walletConnected || !rootInput.trim()}>
                      Push Root On-chain
                    </ActionBtn>
                  </div>
                  <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 space-y-3">
                    <p className="text-xs font-semibold text-blue-700">Option B — Root + Times in one tx (recommended)</p>
                    <p className="text-xs text-blue-500">Calls <code className="bg-blue-100 px-1 rounded">setWL(root, start, end)</code> — uses the times from the Phase & Timing tab.</p>
                    <ActionBtn onClick={handleSetWL} loading={txRoot.pending} disabled={!walletConnected || !rootInput.trim() || !wlStartInput || !wlEndInput}>
                      Set Root + Times Together
                    </ActionBtn>
                  </div>
                </div>
                <TxStatus tx={txRoot} onClear={() => setTxRoot(TX0)} />
              </SectionCard>
            </>
          )}

          {/* ─── Mint Settings ────────────────────────────────────────────── */}
          {tab === "mint" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {[
                  { label: "WL Limit per wallet", value: liveLimits?.l1 ?? "—" },
                  { label: "Paid Limit per wallet", value: liveLimits?.l2 ?? "—" },
                  { label: "SBT Mode", value: liveSbt !== null ? (liveSbt ? "Locked (non-transferable)" : "Unlocked (transferable)") : "—" },
                ].map((s) => (
                  <div key={s.label} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <p className="text-slate-500 mb-1">{s.label}</p>
                    <p className="font-bold text-slate-900 text-sm">{String(s.value)}</p>
                  </div>
                ))}
              </div>

              <SectionCard title="Mint Limits" note="How many NFTs each wallet can mint per phase.">
                <div className="grid grid-cols-2 gap-4">
                  <InputRow label="WL / Public Free limit (per wallet)">
                    <input type="number" min="1" value={limit1} onChange={(e) => setLimit1(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </InputRow>
                  <InputRow label="Paid mint limit (per wallet)">
                    <input type="number" min="1" value={limit2} onChange={(e) => setLimit2(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </InputRow>
                </div>
                <ActionBtn onClick={handleSetLimits} loading={txLimits.pending} disabled={!walletConnected}>Set Limits</ActionBtn>
                <TxStatus tx={txLimits} onClear={() => setTxLimits(TX0)} />
              </SectionCard>

              <SectionCard title="SBT Mode (Soul-Bound Token)" note="When enabled, NFTs cannot be transferred or sold after minting.">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <button
                      role="switch"
                      aria-checked={sbtInput}
                      onClick={() => setSbtInput(!sbtInput)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${sbtInput ? "bg-red-500" : "bg-slate-200"}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${sbtInput ? "translate-x-5" : ""}`} />
                    </button>
                    <span className="text-sm font-medium text-slate-700">
                      {sbtInput ? "Locked — NFTs cannot be transferred" : "Unlocked — transfers allowed"}
                    </span>
                  </label>
                </div>
                <ActionBtn onClick={handleSetSbt} loading={txSbt.pending} disabled={!walletConnected}>
                  {sbtInput ? "Enable SBT Lock" : "Disable SBT Lock"}
                </ActionBtn>
                <TxStatus tx={txSbt} onClear={() => setTxSbt(TX0)} />
              </SectionCard>
            </>
          )}

          {/* ─── Reveal & URIs ────────────────────────────────────────────── */}
          {tab === "reveal" && (
            <>
              <div className="flex items-center gap-3">
                <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${liveRevealed ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {liveRevealed ? "✓ Artwork Revealed" : "⬜ Blind Box (not revealed)"}
                </div>
              </div>

              <SectionCard title="Reveal NFT Artwork" note="Sets the reveal URI and switches NFTs from blind-box to full artwork. This action is irreversible.">
                <InputRow label="Reveal URI (IPFS or HTTPS)">
                  <input value={revealUri} onChange={(e) => setRevealUri(e.target.value)}
                    placeholder="ipfs://Qm... or https://..."
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </InputRow>
                <ActionBtn onClick={handleReveal} loading={txReveal.pending} disabled={!walletConnected || !revealUri.trim()}>
                  Reveal Artwork
                </ActionBtn>
                <TxStatus tx={txReveal} onClear={() => setTxReveal(TX0)} />
              </SectionCard>


              <SectionCard title="Check Token Metadata" note="Reads tokenURI from contract and fetches the JSON metadata.">
                <InputRow label="Token ID">
                  <div className="flex gap-2">
                    <input value={checkTokenId} onChange={(e) => { setCheckTokenId(e.target.value); setCheckMeta(null); setCheckError(""); }}
                      type="number" min="1" placeholder="e.g. 42"
                      className="w-40 px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button
                      onClick={handleCheckMetadata}
                      disabled={checkLoading || !contract || !checkTokenId}
                      className="px-4 py-2.5 text-sm font-semibold bg-slate-700 hover:bg-slate-800 text-white rounded-lg disabled:opacity-50"
                    >
                      {checkLoading ? "Fetching…" : "Fetch Metadata"}
                    </button>
                  </div>
                </InputRow>
                {checkError && <p className="text-xs text-red-600">{checkError}</p>}
                {checkMeta && (
                  <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-auto max-h-64 text-slate-700">
                    {JSON.stringify(checkMeta, null, 2)}
                  </pre>
                )}
              </SectionCard>
            </>
          )}

          {/* ─── Financial ────────────────────────────────────────────────── */}
          {tab === "financial" && (
            <>
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
                <p className="text-xs text-slate-400 mb-1">Contract Balance</p>
                <p className="text-3xl font-bold">{liveBalance || "—"} <span className="text-slate-300 text-lg">ETH</span></p>
                <p className="text-xs text-slate-500 mt-1">{activeChain.name} · {activeChain.contractAddress.slice(0, 10)}…</p>
              </div>

              <SectionCard title="Withdraw ETH" note="Transfers the contract's ETH balance to the specified address. Requires WITHDRAWER_ROLE.">
                <InputRow label="Destination Address">
                  <input value={withdrawTo} onChange={(e) => setWithdrawTo(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </InputRow>
                <ActionBtn onClick={handleWithdraw} loading={txWithdraw.pending} disabled={!walletConnected || !withdrawTo.trim()} danger>
                  Withdraw ETH
                </ActionBtn>
                <TxStatus tx={txWithdraw} onClear={() => setTxWithdraw(TX0)} />
              </SectionCard>

              <SectionCard title="Royalty Settings" note="EIP-2981 royalty — receiver address and fee in basis points (100 bps = 1%).">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <InputRow label="Receiver Address">
                      <input value={royaltyReceiver} onChange={(e) => setRoyaltyReceiver(e.target.value)}
                        placeholder="0x..."
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </InputRow>
                  </div>
                  <InputRow label={`Fee — ${royaltyBps} bps = ${(Number(royaltyBps) / 100).toFixed(1)}%`}>
                    <input type="number" min="0" max="10000" value={royaltyBps} onChange={(e) => setRoyaltyBps(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </InputRow>
                </div>
                <ActionBtn onClick={handleSetRoyalty} loading={txRoyalty.pending} disabled={!walletConnected || !royaltyReceiver.trim()}>
                  Set Royalty
                </ActionBtn>
                <TxStatus tx={txRoyalty} onClear={() => setTxRoyalty(TX0)} />
              </SectionCard>
            </>
          )}

          {/* ─── Advanced ─────────────────────────────────────────────────── */}
          {tab === "advanced" && (
            <>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                These operations are potentially irreversible. Use only when necessary.
              </div>

              <SectionCard title="Pause / Unpause Contract" note="Pausing halts all minting and transfers globally.">
                <div className="flex items-center gap-3">
                  <ActionBtn onClick={handlePause} loading={txPause.pending} disabled={!walletConnected} danger>
                    Pause Contract
                  </ActionBtn>
                  <ActionBtn onClick={handleUnpause} loading={txPause.pending} disabled={!walletConnected}>
                    Unpause Contract
                  </ActionBtn>
                </div>
                <TxStatus tx={txPause} onClear={() => setTxPause(TX0)} />
              </SectionCard>

              <SectionCard title="Pause / Unpause Account" note="Blocks or restores a specific wallet address from minting.">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputRow label="Address to Pause">
                    <div className="flex gap-2">
                      <input value={pauseAccountAddr} onChange={(e) => setPauseAccountAddr(e.target.value)}
                        placeholder="0x..." className="flex-1 px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <ActionBtn onClick={handlePauseAccount} loading={txPauseAcc.pending} disabled={!walletConnected || !pauseAccountAddr.trim()} danger>
                        Pause
                      </ActionBtn>
                    </div>
                  </InputRow>
                  <InputRow label="Address to Unpause">
                    <div className="flex gap-2">
                      <input value={unpauseAccountAddr} onChange={(e) => setUnpauseAccountAddr(e.target.value)}
                        placeholder="0x..." className="flex-1 px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <ActionBtn onClick={handleUnpauseAccount} loading={txPauseAcc.pending} disabled={!walletConnected || !unpauseAccountAddr.trim()}>
                        Unpause
                      </ActionBtn>
                    </div>
                  </InputRow>
                </div>
                <TxStatus tx={txPauseAcc} onClear={() => setTxPauseAcc(TX0)} />
              </SectionCard>

              <SectionCard title="Batch Mint" note="Admin-mint multiple NFTs to a single address (requires admin role).">
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <InputRow label="Recipient Address">
                      <input value={batchMintTo} onChange={(e) => setBatchMintTo(e.target.value)}
                        placeholder="0x..."
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </InputRow>
                  </div>
                  <div className="w-28">
                    <InputRow label="Amount">
                      <input type="number" min="1" value={batchMintAmt} onChange={(e) => setBatchMintAmt(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </InputRow>
                  </div>
                  <div className="pb-0.5">
                    <ActionBtn onClick={handleBatchMint} loading={txBatch.pending} disabled={!walletConnected || !batchMintTo.trim()}>
                      Mint
                    </ActionBtn>
                  </div>
                </div>
                <TxStatus tx={txBatch} onClear={() => setTxBatch(TX0)} />
              </SectionCard>

              <SectionCard title="Emergency Transfer" note="Force-transfer a specific NFT. Requires EMERGENCY_ROLE. Intended for lost-wallet recovery.">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputRow label="Token ID">
                    <input type="number" value={emergencyTokenId} onChange={(e) => setEmergencyTokenId(e.target.value)}
                      placeholder="e.g. 42"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </InputRow>
                  <div />
                  <InputRow label="From Address">
                    <input value={emergencyFrom} onChange={(e) => setEmergencyFrom(e.target.value)}
                      placeholder="0x..."
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </InputRow>
                  <InputRow label="To Address">
                    <input value={emergencyTo} onChange={(e) => setEmergencyTo(e.target.value)}
                      placeholder="0x..."
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </InputRow>
                  <div className="sm:col-span-2">
                    <InputRow label="Reason (logged on-chain)">
                      <input value={emergencyReason} onChange={(e) => setEmergencyReason(e.target.value)}
                        placeholder="e.g. Lost wallet recovery — user verified via KYC"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </InputRow>
                  </div>
                </div>
                <ActionBtn
                  onClick={handleEmergencyTransfer}
                  loading={txEmergency.pending}
                  disabled={!walletConnected || !emergencyTokenId || !emergencyFrom.trim() || !emergencyTo.trim()}
                  danger
                >
                  Execute Emergency Transfer
                </ActionBtn>
                <TxStatus tx={txEmergency} onClear={() => setTxEmergency(TX0)} />
              </SectionCard>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
