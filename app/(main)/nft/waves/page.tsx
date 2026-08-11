"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useInterval } from "@/lib/useInterval";
import { ErrBanner } from "@/components/nft/Banner";
import WhitelistTab from "@/components/nft/tabs/WhitelistTab";
import PacksTab from "@/components/nft/tabs/PacksTab";
import CollaborationsTab from "@/components/nft/tabs/CollaborationsTab";
import MarketNote from "@/components/nft/shared/MarketNote";
import RevealModal from "./components/WaveRevealModal";
import TreasuryMoveModal from "./components/TreasuryMoveModal";
import RevealScheduleEditModal from "./components/RevealScheduleEditModal";
import WavesTable from "./components/WavesTable";
import WaveManageModal from "./components/WaveManageModal";
import WaveProgressStepper from "./components/WaveProgressStepper";
import TxSuccessModal from "@/components/nft/shared/TxSuccessModal";
import { Wave, WaveSchedule, SaleMethod, OnChainWaveInfo, WaveManageForm } from "./wave-types";
import { STATE_META, PHASE_LABELS, PHASE_COLORS, toLocalDateTimeInput, fmtDatetime as fmtFull } from "@/lib/nft-utils";

function waveState(w: WaveSchedule): "revealed" | "ready_reveal" | "reveal_scheduled" | "active" | "ended" | "ended_zero" | "upcoming" | "not_scheduled" {
  const now = Date.now();
  if (w.is_revealed) return "revealed";
  if (w.wave_start_triggered && !w.wave_end_triggered) return "active";
  if (w.wave_end_triggered) {
    if (w.reveal_scheduled_at && new Date(w.reveal_scheduled_at).getTime() <= now) return "ready_reveal";
    if (w.reveal_scheduled_at && new Date(w.reveal_scheduled_at).getTime() > now) return "reveal_scheduled";
    if ((w.sold_count ?? 0) === 0) return "ended_zero";
    return "ended";
  }
  if (w.scheduled_start && new Date(w.scheduled_start).getTime() > now) return "upcoming";
  return "not_scheduled";
}

function deriveWaveDisplayStatus(w: Wave): string {
  if (w.waveRevealed) return "revealed";
  if (w.waveClosed) {
    const now = Date.now();
    if (w.revealScheduledAt && new Date(w.revealScheduledAt).getTime() <= now) return "ready_reveal";
    if (w.revealScheduledAt && new Date(w.revealScheduledAt).getTime() > now) return "reveal_scheduled";
    return "closed";
  }
  if (w.status === "active" && w.scheduledEnd && new Date(w.scheduledEnd) < new Date()) return "ended";
  return w.status;
}

export default function WavesPage() {
  const searchParams = useSearchParams();
  const strategyHighlight = searchParams.get("saleMethod");
  const strategyName = searchParams.get("strategy");
  const highlightRef = useRef<HTMLDivElement>(null);


  const [activeTab, setActiveTab] = useState<"waves" | "whitelist" | "packs" | "collaborations">("waves");


  const [waves, setWaves] = useState<Wave[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saleMethods, setSaleMethods] = useState<SaleMethod[]>([]);
  const [wavePage, setWavePage] = useState(1);
  const WAVES_PER_PAGE = 10;

  // DB edit modal
  const [editWave, setEditWave] = useState<Wave | null>(null);
  const [manageMaximized, setManageMaximized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState<WaveManageForm>({
    defaultPriceEth: "", saleMethod: "", scheduledStart: "",
    scheduledEnd: "", status: "", unsoldStrategy: "auto_treasury",
    whitelistRequired: false,
  });

  // On-chain action modal
  const [chainWave, setChainWave] = useState<Wave | null>(null);
  const [chainOnChain, setChainOnChain] = useState<OnChainWaveInfo | null>(null);
  const [chainLoading, setChainLoading] = useState(false);
  const [chainSaving, setChainSaving] = useState<string | null>(null);
  const [chainError, setChainError] = useState<string | null>(null);
  const [chainTx, setChainTx] = useState<string | null>(null);

  // Chain form fields
  const [chainPrice, setChainPrice] = useState("");
  const [treasuryMoveWave, setTreasuryMoveWave] = useState<Wave | null>(null);
  const [treasurySuccessData, setTreasurySuccessData] = useState<{ txHash: string; waveNum: number } | null>(null);

  const [revealWaves, setRevealWaves] = useState<WaveSchedule[]>([]);
  const [revealPhase, setRevealPhase] = useState<number | null>(null);
  const [revealLoading, setRevealLoading] = useState(false);
  const [revealErr, setRevealErr] = useState<string | null>(null);
  const [revealWave, setRevealWave] = useState<WaveSchedule | null>(null);
  const [revealSuccessData, setRevealSuccessData] = useState<{ txHash: string; waveNum: number } | null>(null);
  const [scheduleEditWave, setScheduleEditWave] = useState<WaveSchedule | null>(null);
  const [scheduleEditDate, setScheduleEditDate] = useState("");
  const [scheduleEditSaving, setScheduleEditSaving] = useState(false);
  const [scheduleEditErr, setScheduleEditErr] = useState<string | null>(null);
  const [blindBoxUrl, setBlindBoxUrl] = useState<string | null>(null);

  const loadWaves = () => {
    console.group("[WavesPage] loadWaves");
    console.log("fetching /api/nft-sell/waves");
    setLoading(true); setError(null);
    fetch("/api/nft-sell/waves", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        console.log("waves loaded:", d.waves?.length ?? 0);
        console.groupEnd();
        setWaves(d.waves ?? []); setLoading(false);
      })
      .catch(e => {
        console.error("loadWaves failed:", e);
        console.groupEnd();
        setError("Failed to load waves."); setLoading(false);
      });
  };

  const [waveWatchAlert, setWaveWatchAlert] = useState<string | null>(null);
  const [revealReadyCount, setRevealReadyCount] = useState(0);
  const [watchUpdated, setWatchUpdated] = useState<Date | null>(null);

  const silentWavePoll = useCallback(async () => {
    try {
      const res = await fetch("/api/nft-sell/waves", { credentials: "include" });
      if (!res.ok) return;
      const d = await res.json();
      const updated: Wave[] = d.waves ?? [];
      setWatchUpdated(new Date());

      // detect waves whose reveal date has passed but are not yet revealed
      const now = Date.now();
      const readyToReveal = updated.filter(w =>
        w.revealScheduledAt && new Date(w.revealScheduledAt).getTime() <= now && !w.waveRevealed
      );
      setRevealReadyCount(readyToReveal.length);
      if (readyToReveal.length > 0) {
        setWaveWatchAlert(`${readyToReveal.length} wave${readyToReveal.length > 1 ? "s" : ""} ready to reveal: ${readyToReveal.map(w => `Wave ${w.waveNumber}`).join(", ")}`);
      }

      // silently refresh wave list if data changed
      setWaves(updated);
    } catch { /* silent */ }
  }, []);

  useInterval(silentWavePoll, 30_000);

  useEffect(() => {
    loadWaves();
    loadRevealData();
    fetch("/api/nft-sell/lookups/wave-sale-methods", { credentials: "include" })
      .then(r => r.json())
      .then(d => setSaleMethods(d.saleMethods ?? []))
      .catch(() => { });
    fetch("/api/nft-sell/collection/stats", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.blindBoxImageUrl) setBlindBoxUrl(d.blindBoxImageUrl); })
      .catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (strategyHighlight && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [strategyHighlight, waves]);

  const loadRevealData = useCallback(async () => {
    setRevealLoading(true); setRevealErr(null);
    try {
      const [wr, sr] = await Promise.all([
        fetch("/api/nft-sell/waves/schedule-status", { credentials: "include" }),
        fetch("/api/nft-sell/scheduler/status", { credentials: "include" }),
      ]);
      const wd = await wr.json();
      setRevealWaves(wd.waves ?? []);
      if (sr.ok) {
        const sd = await sr.json();
        if (sd.configured) setRevealPhase(sd.currentPhase ?? null);
      }
    } catch {
      setRevealErr("Failed to load wave data");
    } finally {
      setRevealLoading(false);
    }
  }, []);

  const saveRevealDate = async () => {
    if (!scheduleEditWave) return;
    const matched = waves.find(w => w.waveNumber === scheduleEditWave.wave_number);
    if (!matched) { setScheduleEditErr("Wave not found."); return; }
    setScheduleEditSaving(true); setScheduleEditErr(null);
    try {
      const res = await fetch(`/api/waves/${matched.id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revealScheduledAt: scheduleEditDate ? new Date(scheduleEditDate).toISOString() : null }),
      });
      if (!res.ok) { const d = await res.json(); setScheduleEditErr(d.error ?? "Save failed"); return; }
      setScheduleEditWave(null);
      loadRevealData();
      loadWaves();
    } catch { setScheduleEditErr("Network error."); }
    finally { setScheduleEditSaving(false); }
  };

  const openEdit = (w: Wave) => {
    setEditWave(w);
    setForm({
      defaultPriceEth: w.defaultPriceEth != null ? String(w.defaultPriceEth) : "",
      saleMethod: w.saleMethod ?? "fixed_price",
      scheduledStart: w.scheduledStart ? toLocalDateTimeInput(new Date(w.scheduledStart)) : "",
      scheduledEnd: w.scheduledEnd ? toLocalDateTimeInput(new Date(w.scheduledEnd)) : "",
      status: w.status ?? "upcoming",
      unsoldStrategy: (w.unsoldStrategy ?? "auto_treasury") as 'auto_treasury' | 'manual',
      whitelistRequired: w.whitelistRequired ?? false,
    });
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!editWave) return;
    setSaving(true); setSaveError(null);
    try {
      const body: Record<string, unknown> = {
        defaultPriceEth: form.defaultPriceEth !== "" ? Number(form.defaultPriceEth) : null,
        saleMethod: form.saleMethod || null,
        scheduledStart: form.scheduledStart ? new Date(form.scheduledStart).toISOString() : null,
        scheduledEnd: form.scheduledEnd ? new Date(form.scheduledEnd).toISOString() : null,
        status: form.status || null,
        unsoldStrategy: form.unsoldStrategy,
        whitelistRequired: form.whitelistRequired,
      };
      const res = await fetch(`/api/waves/${editWave.id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setSaveError(d.error ?? "Save failed."); return; }
      setEditWave(null); loadWaves();
    } catch { setSaveError("Network error."); }
    finally { setSaving(false); }
  };

  const openManage = (w: Wave) => {
    console.group("[WavesPage] openManage");
    console.log("wave:", w.waveNumber, w.name, "status:", w.status);
    openEdit(w);
    setChainWave(w); setChainError(null); setChainTx(null); setChainOnChain(null);
    setChainPrice(w.defaultPriceEth != null ? String(w.defaultPriceEth) : "");
    setChainLoading(true);
    fetch(`/api/nft-sell/waves/${w.waveNumber}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { console.log("on-chain state:", d.onChain); console.groupEnd(); setChainOnChain(d.onChain ?? null); })
      .catch(() => { console.groupEnd(); })
      .finally(() => setChainLoading(false));
  };

  const closeManage = () => {
    setEditWave(null); setChainWave(null);
    setChainTx(null); setChainError(null);
    setManageMaximized(false);
  };

  const chainOp = async (opName: string, fn: () => Promise<Response>) => {
    console.group(`[WavesPage] chainOp: ${opName}`);
    console.log("wave:", chainWave?.waveNumber);
    setChainSaving(opName); setChainError(null); setChainTx(null);
    try {
      const res = await fn();
      const d = await res.json();
      if (!res.ok) { setChainError(d.error ?? `${opName} failed.`); return; }
      console.log("chainOp success, txHash:", d.txHash ?? null);
      setChainTx(d.txHash ?? null);
      const fresh = await fetch(`/api/nft-sell/waves/${chainWave!.waveNumber}`, { credentials: "include" }).then(r => r.json());
      setChainOnChain(fresh.onChain ?? null);
      loadWaves();
    } catch (e) {
      console.error("chainOp network error:", e);
      setChainError("Network error.");
    }
    finally { console.groupEnd(); setChainSaving(null); }
  };

  const handleSetScheduleOnChain = () => {
    if (!editWave?.scheduledStart || !editWave?.scheduledEnd) {
      setChainError("No schedule in DB — set start/end dates in the Settings tab first.");
      return;
    }
    chainOp("schedule", () => fetch(`/api/nft-sell/waves/${chainWave!.waveNumber}/schedule`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startUnix: Math.floor(new Date(editWave.scheduledStart!).getTime() / 1000),
        endUnix: Math.floor(new Date(editWave.scheduledEnd!).getTime() / 1000),
      }),
    }));
  };

  const handleSetPriceOnChain = () => {
    if (!chainPrice || isNaN(parseFloat(chainPrice))) { setChainError("Enter a valid price."); return; }
    chainOp("price", () => fetch(`/api/nft-sell/waves/${chainWave!.waveNumber}/price`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceEth: chainPrice }),
    }));
  };


  function handleRevealSuccess(txHash: string, waveNum: number) {
    console.group("[WavesPage] handleRevealSuccess");
    console.log("txHash:", txHash, "waveNum:", waveNum);
    console.groupEnd();
    setRevealWave(null);
    setRevealSuccessData({ txHash, waveNum });
    loadRevealData();
    loadWaves();
  }

  const totalNfts = waves.reduce((s, w) => s + (w.quantity ?? 0), 0);
  const activeWave = waves.find(w => deriveWaveDisplayStatus(w) === "active");
  // Waves whose minting period is over: closed, reveal-scheduled, ready-to-reveal, revealed, or transitional ended
  const completedCount = waves.filter(w =>
    ["revealed", "closed", "reveal_scheduled", "ready_reveal", "ended"].includes(deriveWaveDisplayStatus(w))
  ).length;
  const totalSold = waves.reduce((s, w) => s + (w.soldCount ?? w.onChain?.soldCount ?? 0), 0);

  const revealNow = Date.now();
  const readyCount = Math.max(
    revealWaves.filter(w => waveState(w) === "ready_reveal").length,
    revealReadyCount
  );
  const nextAction = revealWaves
    .flatMap(w => [
      w.scheduled_start && !w.wave_start_triggered ? { label: `W${w.wave_number} starts`, dt: new Date(w.scheduled_start).getTime() } : null,
      w.reveal_scheduled_at && !w.wave_reveal_triggered && !w.is_revealed ? { label: `W${w.wave_number} reveal due`, dt: new Date(w.reveal_scheduled_at).getTime() } : null,
    ])
    .filter((x): x is { label: string; dt: number } => x !== null && x.dt > revealNow)
    .sort((a, b) => a.dt - b.dt)[0] ?? null;

  const TAB_STYLE_ACTIVE = {
    color: "#24315f",
    borderBottom: "2px solid #41afeb",
    fontWeight: 700,
    background: "transparent",
  };
  const TAB_STYLE_INACTIVE = {
    color: "#9bafc5",
    borderBottom: "2px solid transparent",
    fontWeight: 600,
    background: "transparent",
  };

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "#24315f" }}>NFT Waves</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
            Manage wave pricing, schedules, reveal dates and on-chain wave actions
          </p>
        </div>
        <button
          onClick={() => { loadWaves(); loadRevealData(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ border: "1px solid #e5e7eb", color: "#6b7280", background: "white" }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>
      <div className="ba-tabs" style={{ borderBottom: "1px solid #e5e7eb" }}>
        <div className="flex gap-0">
          {([
            { key: "waves",          label: "Waves",          market: "primary" },
            { key: "whitelist",      label: "Whitelist",      market: "primary" },
            { key: "packs",          label: "Mystery Packs",  market: "primary" },
            { key: "collaborations", label: "Collaborations", market: "both" },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm transition-colors"
              style={activeTab === tab.key ? TAB_STYLE_ACTIVE : TAB_STYLE_INACTIVE}>
              {tab.label}
              <MarketNote market={tab.market} />
            </button>
          ))}
        </div>
      </div>


      {waveWatchAlert && (
        <div className="flex items-center justify-between px-4 py-2 rounded-xl text-sm"
          style={{ background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.25)", color: "#d97706" }}>
          <span>âš¡ {waveWatchAlert}</span>
          <button onClick={() => setWaveWatchAlert(null)} className="ml-4 text-xs opacity-60 hover:opacity-100">âœ•</button>
        </div>
      )}
      {watchUpdated && (
        <div className="flex items-center gap-1.5 text-xs" style={{ color: "#9bafc5" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
          Live Â· last checked {watchUpdated.toLocaleTimeString()}
        </div>
      )}

      {activeTab === "waves" && (
        <>
          {/* Strategy banner */}
          {strategyHighlight && (
            <div ref={highlightRef} className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
              style={{ background: "rgba(65,175,235,0.08)", border: "1px solid rgba(65,175,235,0.3)" }}>
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="#41afeb" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <span className="font-bold" style={{ color: "#41afeb" }}>
                  {strategyName ? `Strategy: ${strategyName}` : "Strategy selected"}
                </span>
                <span className="ml-2" style={{ color: "#6b7280" }}>
                  — Configure waves with{" "}
                  <strong>{saleMethods.find(s => s.code === strategyHighlight)?.label ?? strategyHighlight}</strong>{" "}
                  as the sale method. Edit each wave below and set Sale Method accordingly.
                </span>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Waves", value: String(waves.length), color: "#41afeb" },
              { label: "Complete", value: String(completedCount), color: "#16a34a" },
              { label: "Active Wave", value: activeWave?.name ?? "—", color: "#7c3aed", small: true },
              { label: "Total Minted", value: `${totalSold.toLocaleString()} / ${totalNfts.toLocaleString()}`, color: "#24315f", small: true },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#9bafc5" }}>{s.label}</p>
                <p className={`font-bold ${s.small ? "text-sm" : "text-2xl"}`} style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {error && <ErrBanner msg={error} onDismiss={() => setError(null)} />}
          {revealErr && <ErrBanner msg={revealErr} onDismiss={() => setRevealErr(null)} />}

          {/* Contract phase badge */}
          {revealPhase !== null && (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ background: PHASE_COLORS[revealPhase]?.bg ?? "#f3f4f6", color: PHASE_COLORS[revealPhase]?.color ?? "#6b7280" }}>
                Contract: {PHASE_LABELS[revealPhase] ?? `Phase ${revealPhase}`}
              </span>
            </div>
          )}

          {/* Collection Reveal Progress */}
          {revealWaves.length > 0 && (
            <WaveProgressStepper revealWaves={revealWaves} stateMeta={STATE_META} />
          )}

          {/* Ready-to-reveal alert */}
          {readyCount > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.3)" }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(217,119,6,0.15)" }}>
                <svg className="w-4 h-4" style={{ color: "#d97706" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "#d97706" }}>
                  {readyCount} wave{readyCount > 1 ? "s" : ""} ready to reveal
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#92400e" }}>
                  Reveal date has passed. Find the wave below and click &quot;Reveal Now&quot;.
                </p>
              </div>
            </div>
          )}

          {/* Next upcoming action */}
          {!readyCount && nextAction && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: "rgba(65,175,235,0.06)", border: "1px solid rgba(65,175,235,0.2)" }}>
              <svg className="w-4 h-4 flex-shrink-0" style={{ color: "#41afeb" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm" style={{ color: "#374151" }}>
                <strong style={{ color: "#41afeb" }}>Next: </strong>
                {nextAction.label} on {fmtFull(new Date(nextAction.dt).toISOString())}
              </span>
            </div>
          )}

          {/* Waves Table */}
          <WavesTable
            waves={waves}
            loading={loading}
            wavePage={wavePage}
            setWavePage={setWavePage}
            saleMethods={saleMethods}
            onManage={openManage}
            onReveal={setRevealWave}
            onTreasuryMove={setTreasuryMoveWave}
            onSetRevealDate={(w, ws) => {
              setScheduleEditWave(ws);
              setScheduleEditDate(w.revealScheduledAt ? toLocalDateTimeInput(new Date(w.revealScheduledAt)) : "");
              setScheduleEditErr(null);
            }}
            highlightRef={highlightRef}
            strategyHighlight={strategyHighlight}
            WAVES_PER_PAGE={WAVES_PER_PAGE}
          />
        </>
      )}

      {activeTab === "whitelist" && <WhitelistTab />}
      {activeTab === "packs" && <PacksTab />}
      {activeTab === "collaborations" && <CollaborationsTab />}

      {/* Reveal Date Editor Modal */}
      {scheduleEditWave && (
        <RevealScheduleEditModal
          wave={scheduleEditWave}
          date={scheduleEditDate}
          onDateChange={setScheduleEditDate}
          onSave={saveRevealDate}
          onClose={() => setScheduleEditWave(null)}
          saving={scheduleEditSaving}
          error={scheduleEditErr}
        />
      )}

      {revealWave && (
        <RevealModal
          wave={revealWave}
          onClose={() => setRevealWave(null)}
          onSuccess={(txHash) => handleRevealSuccess(txHash, revealWave.wave_number)}
        />
      )}
      {revealSuccessData && (
        <TxSuccessModal
          title={`Wave ${revealSuccessData.waveNum} Revealed!`}
          message="The reveal transaction was submitted on-chain. Buyers can now see their NFT artwork."
          txHash={revealSuccessData.txHash}
          onClose={() => setRevealSuccessData(null)}
        />
      )}


      {/* Treasury Move Modal */}
      {treasuryMoveWave && (
        <TreasuryMoveModal
          wave={treasuryMoveWave}
          onClose={() => setTreasuryMoveWave(null)}
          onSuccess={(txHash) => {
            setTreasuryMoveWave(null);
            setTreasurySuccessData({ txHash, waveNum: treasuryMoveWave.waveNumber });
            loadWaves();
          }}
        />
      )}
      {treasurySuccessData && (
        <TxSuccessModal
          title={`Wave ${treasurySuccessData.waveNum} Transferred!`}
          message={`Unsold NFTs from Wave ${treasurySuccessData.waveNum} have been minted to the treasury wallet.`}
          txHash={treasurySuccessData.txHash}
          onClose={() => setTreasurySuccessData(null)}
        />
      )}

      {/* Manage Modal */}
      {editWave && (
        <WaveManageModal
          wave={editWave}
          onClose={closeManage}
          maximized={manageMaximized}
          onMaximize={() => setManageMaximized(m => !m)}
          form={form}
          setForm={setForm}
          saving={saving}
          saveError={saveError}
          onSave={handleSave}
          chainOnChain={chainOnChain}
          chainLoading={chainLoading}
          chainSaving={chainSaving}
          chainError={chainError}
          setChainError={setChainError}
          chainTx={chainTx}
          chainPrice={chainPrice}
          setChainPrice={setChainPrice}
          onSetScheduleOnChain={handleSetScheduleOnChain}
          onSetPriceOnChain={handleSetPriceOnChain}
        />
      )}

    </div>
  );
}


