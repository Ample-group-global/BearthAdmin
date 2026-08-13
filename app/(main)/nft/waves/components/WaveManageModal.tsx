"use client";

import { ErrBanner, TxBanner as SharedTxBanner } from "@/components/nft/Banner";
import { labelStyle, inputStyle } from "@/components/nft/styles";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Wave {
  id: string;
  waveNumber: number;
  name: string;
  stageId: string | null;
  stageName: string | null;
  quantity: number | null;
  cumulativeStart: number | null;
  cumulativeEnd: number | null;
  defaultPriceEth: number | null;
  saleMethod: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  revealScheduledAt: string | null;
  waveRevealedAt: string | null;
  tierPrices: { legendary?: number; epic?: number; rare?: number; common?: number } | null;
  status: string;
  notes: string | null;
  nftCount: number;
  soldCount?: number;
  treasuryPendingCount?: number;
  priceLocked?: boolean;
  waveClosed?: boolean;
  waveRevealed?: boolean;
  waveRevealTriggered?: boolean;
  waveRevealUri?: string | null;
  closeAction?: string | null;
  unsoldStrategy?: "auto_treasury" | "manual";
  revealStrategy?: "auto" | "manual";
  whitelistRequired?: boolean;
  maxPerWallet?: number;
  syncedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  onChain?: {
    priceEth: number;
    qty: number;
    soldCount: number;
    startTime: number;
    endTime: number;
    closed: boolean;
    active: boolean;
    revealed: boolean;
    purchaseLimit?: number;
  } | null;
}

interface OnChainWaveInfo {
  price: string;
  qty: number;
  soldCount: number;
  startTime: number;
  endTime: number;
  closed: boolean;
  purchaseLimit?: number;
}

interface WaveManageForm {
  defaultPriceEth: string;
  saleMethod?: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  unsoldStrategy: "auto_treasury" | "manual";
  revealStrategy: "auto" | "manual";
  whitelistRequired: boolean;
  revealUri: string;
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface WaveManageModalProps {
  wave: Wave;
  onClose: () => void;
  maximized: boolean;
  onMaximize: () => void;
  form: WaveManageForm;
  setForm: React.Dispatch<React.SetStateAction<WaveManageForm>>;
  saving: boolean;
  saveError: string | null;
  onSave: () => void;
  chainOnChain: OnChainWaveInfo | null;
  chainLoading: boolean;
  chainSaving: string | null;
  chainError: string | null;
  setChainError: (v: string | null) => void;
  chainTx: string | null;
  chainPrice: string;
  setChainPrice: (v: string) => void;
  onSetScheduleOnChain: () => void;
  onSetPriceOnChain: () => void;
  purchaseLimitInput: string;
  setPurchaseLimitInput: (v: string) => void;
  onSetPurchaseLimitOnChain: () => void;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const PAUSE_TOGGLE = "paused";

// ─── WaveManageModal ───────────────────────────────────────────────────────────

export default function WaveManageModal({
  wave: editWave,
  onClose: closeManage,
  maximized: manageMaximized,
  onMaximize,
  form,
  setForm,
  saving,
  saveError,
  onSave: handleSave,
  chainOnChain,
  chainLoading,
  chainSaving,
  chainError,
  setChainError,
  chainTx,
  chainPrice,
  setChainPrice,
  onSetScheduleOnChain: handleSetScheduleOnChain,
  onSetPriceOnChain: handleSetPriceOnChain,
  purchaseLimitInput,
  setPurchaseLimitInput,
  onSetPurchaseLimitOnChain: handleSetPurchaseLimitOnChain,
}: WaveManageModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className={`ba-modal-manage shadow-xl flex flex-col transition-all duration-200${manageMaximized ? " maximized" : ""}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #e5e7eb" }}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: "rgba(65,175,235,0.1)", color: "#41afeb" }}>
                W{editWave.waveNumber}
              </span>
              <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>{editWave.name}</h2>
            </div>
            <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
              Configure wave settings and push on-chain actions
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={onMaximize}
              title={manageMaximized ? "Restore" : "Maximize"}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: "#9bafc5", border: "1px solid #e5e7eb" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#f3f4f6"; e.currentTarget.style.color = "#374151"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9bafc5"; }}>
              {manageMaximized ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              )}
            </button>
            <button onClick={closeManage} style={{ color: "#9bafc5" }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Single scrollable body */}
        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          {saveError && (
            <div className="p-3 rounded-lg text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
              {saveError}
            </div>
          )}

          {/* Wave Quantity — read-only */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
            style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
            <svg className="w-4 h-4 flex-shrink-0" style={{ color: "#9bafc5" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div>
              <p className="text-xs font-bold" style={{ color: "#374151" }}>
                Wave Quantity: {(editWave.quantity ?? 0).toLocaleString()} NFTs
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
                Fixed at launch — predefined by the Fibonacci allocation plan
              </p>
            </div>
          </div>

          {/* Price + Sale Method */}
          {editWave.waveNumber === 1 ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: "rgba(65,175,235,0.07)", border: "1px solid rgba(65,175,235,0.2)" }}>
              <span className="text-xs font-semibold" style={{ color: "#41afeb" }}>Free Mint — no price applies to Wave 1</span>
            </div>
          ) : editWave.waveClosed ? (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
              <svg className="w-4 h-4 flex-shrink-0" style={{ color: "#9bafc5" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div>
                <p className="text-xs font-bold" style={{ color: "#374151" }}>
                  Final Price: {editWave.defaultPriceEth != null ? `${editWave.defaultPriceEth} ETH` : "Free"} · Fixed Price
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
                  Wave closed — price and sale method are permanently locked
                </p>
              </div>
            </div>
          ) : (
            <div className="ba-form-2">
              <div>
                <label style={labelStyle}>Default Price (ETH)</label>
                <input type="number" step="0.0001" min="0"
                  value={form.defaultPriceEth}
                  onChange={e => { if (!editWave.priceLocked) setForm({ ...form, defaultPriceEth: e.target.value }); }}
                  style={editWave.priceLocked ? { ...inputStyle, background: "#f9fafb", color: "#6b7280", cursor: "not-allowed" } : inputStyle}
                  readOnly={!!editWave.priceLocked}
                  placeholder="0 = Free" />
                {editWave.priceLocked && (
                  <p className="text-xs mt-1" style={{ color: "#dc2626" }}>
                    Locked — first sale occurred. Price cannot be changed.
                  </p>
                )}
              </div>
              <div>
                <label style={labelStyle}>Sale Method</label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: "rgba(65,175,235,0.07)", border: "1px solid rgba(65,175,235,0.2)", height: "38px" }}>
                  <span className="text-xs font-semibold" style={{ color: "#41afeb" }}>Fixed Price</span>
                </div>
              </div>
            </div>
          )}

          {/* Emergency Pause */}
          {!editWave.waveClosed && <div className="flex items-center justify-between p-3 rounded-xl"
            style={{
              background: form.status === PAUSE_TOGGLE ? "rgba(217,119,6,0.07)" : "#f9fafb",
              border: `1px solid ${form.status === PAUSE_TOGGLE ? "rgba(217,119,6,0.3)" : "#e5e7eb"}`,
            }}>
            <div>
              <p className="text-xs font-bold" style={{ color: form.status === PAUSE_TOGGLE ? "#d97706" : "#374151" }}>
                Emergency Pause
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
                Halts minting for this wave. Auto-trigger will not override this at wave start.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-4 flex-shrink-0">
              <input type="checkbox" className="sr-only"
                checked={form.status === PAUSE_TOGGLE}
                onChange={e => {
                  if (e.target.checked) {
                    setForm({ ...form, status: "paused" });
                  } else {
                    const now = new Date();
                    let autoStatus = "upcoming";
                    if (editWave.scheduledEnd && new Date(editWave.scheduledEnd) <= now) {
                      autoStatus = "closed";
                    } else if (editWave.scheduledStart && new Date(editWave.scheduledStart) <= now) {
                      autoStatus = "active";
                    }
                    setForm({ ...form, status: autoStatus });
                  }
                }} />
              <div className="w-10 h-6 rounded-full transition-colors"
                style={{ background: form.status === PAUSE_TOGGLE ? "#d97706" : "#d1d5db" }} />
              <div className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform"
                style={{ left: 4, transform: form.status === PAUSE_TOGGLE ? "translateX(16px)" : "translateX(0)" }} />
            </label>
          </div>}

          {/* Schedule */}
          {(() => {
            const schedLocked = editWave.waveClosed ||
              editWave.status === "active" ||
              !!(editWave.scheduledStart && new Date(editWave.scheduledStart) <= new Date());
            return (
              <div className="space-y-3">
                <label style={{ ...labelStyle, marginBottom: 0 }}>Wave Schedule</label>
                {schedLocked ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-2.5 rounded-lg" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "#9bafc5" }}>Start Date</p>
                        <p className="text-xs font-semibold" style={{ color: "#374151" }}>
                          {editWave.scheduledStart ? new Date(editWave.scheduledStart).toLocaleString() : <span style={{ color: "#d1d5db" }}>Not set</span>}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "#9bafc5" }}>End Date</p>
                        <p className="text-xs font-semibold" style={{ color: "#374151" }}>
                          {editWave.scheduledEnd ? new Date(editWave.scheduledEnd).toLocaleString() : <span style={{ color: "#d1d5db" }}>Not set</span>}
                        </p>
                      </div>
                    </div>
                    <p className="text-[10px]" style={{ color: "#9bafc5" }}>
                      Wave schedule is locked — dates cannot be changed after the wave starts.
                    </p>
                  </>
                ) : (
                  <div className="ba-form-2">
                    <div>
                      <label style={labelStyle}>Start Date</label>
                      <input type="datetime-local" value={form.scheduledStart}
                        onChange={e => setForm({ ...form, scheduledStart: e.target.value })} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>End Date</label>
                      <input type="datetime-local" value={form.scheduledEnd}
                        onChange={e => setForm({ ...form, scheduledEnd: e.target.value })} style={inputStyle} />
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* On-Chain Actions banner */}
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
            style={{ background: "rgba(217,119,6,0.07)", border: "1px solid rgba(217,119,6,0.25)" }}>
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#d97706" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-xs font-bold mb-0.5" style={{ color: "#d97706" }}>On-Chain Actions</p>
              <p className="text-xs leading-relaxed" style={{ color: "#92400e" }}>
                Each action submits a blockchain transaction. Costs gas, requires wallet approval, and cannot be undone.
              </p>
            </div>
          </div>

          {chainLoading && (
            <div className="flex items-center gap-2 text-xs" style={{ color: "#9bafc5" }}>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Reading on-chain state…
            </div>
          )}

          {chainOnChain && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Minted", value: `${chainOnChain.soldCount} / ${chainOnChain.qty}` },
                { label: "Price", value: `${chainOnChain.price} ETH` },
                { label: "Closed", value: chainOnChain.closed ? "Yes" : "No" },
              ].map(s => (
                <div key={s.label} className="p-3 rounded-xl text-center" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                  <p className="text-xs" style={{ color: "#9bafc5" }}>{s.label}</p>
                  <p className="font-bold text-sm mt-0.5" style={{ color: "#24315f" }}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* DB ↔ On-Chain price sync indicator */}
          {chainOnChain && editWave.waveNumber > 1 && (() => {
            const onChainPrice = parseFloat(chainOnChain.price);
            const dbPrice = editWave.defaultPriceEth;
            if (dbPrice == null) return null;
            const outOfSync = Math.abs(onChainPrice - dbPrice) > 0.000001;
            return outOfSync ? (
              <div className="flex items-start gap-3 p-3 rounded-xl text-xs"
                style={{ background: "rgba(220,38,38,0.06)", border: "1px solid #fecaca" }}>
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#dc2626" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div style={{ color: "#dc2626" }}>
                  <p className="font-bold">Price out of sync</p>
                  <p className="mt-0.5">
                    On-chain: <strong>{chainOnChain.price} ETH</strong> · DB: <strong>{dbPrice} ETH</strong>
                  </p>
                  {!editWave.waveClosed && !editWave.priceLocked && (
                    <p className="mt-0.5" style={{ color: "#92400e" }}>
                      Use &quot;Set Wave Price On-Chain&quot; below to sync the on-chain price to match DB.
                    </p>
                  )}
                  {editWave.priceLocked && (
                    <p className="mt-0.5" style={{ color: "#92400e" }}>
                      Price is locked (first sale occurred) — on-chain and DB are now permanently diverged.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                style={{ background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.3)", color: "#16a34a" }}>
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                On-chain price matches DB ({dbPrice} ETH)
              </div>
            );
          })()}

          {chainTx && <SharedTxBanner txHash={chainTx} />}
          {chainError && <ErrBanner msg={chainError} onDismiss={() => setChainError(null)} />}

          {/* Push Schedule On-Chain — only before wave has started */}
          {(() => {
            const waveStarted = editWave.waveClosed || editWave.status === "active";
            return !waveStarted ? (
              <div className="space-y-3 p-4 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                <p className="text-xs font-bold" style={{ color: "#24315f" }}>Push Wave Schedule On-Chain</p>
                <p className="text-xs" style={{ color: "#9bafc5" }}>
                  The system auto-pushes when the scheduled date arrives. Use this only if you need to push early or re-sync.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 rounded-lg" style={{ background: "#f3f4f6", border: "1px solid #e5e7eb" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "#9bafc5" }}>Start Date</p>
                    <p className="text-xs font-semibold" style={{ color: "#374151" }}>
                      {editWave.scheduledStart ? new Date(editWave.scheduledStart).toLocaleString() : <span style={{ color: "#d1d5db" }}>Not set</span>}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg" style={{ background: "#f3f4f6", border: "1px solid #e5e7eb" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "#9bafc5" }}>End Date</p>
                    <p className="text-xs font-semibold" style={{ color: "#374151" }}>
                      {editWave.scheduledEnd ? new Date(editWave.scheduledEnd).toLocaleString() : <span style={{ color: "#d1d5db" }}>Not set</span>}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    console.log("[WaveManageModal] Push Schedule On-Chain — waveNumber:", editWave.waveNumber, "start:", editWave.scheduledStart, "end:", editWave.scheduledEnd);
                    handleSetScheduleOnChain();
                  }}
                  disabled={chainSaving === "schedule" || !editWave.scheduledStart || !editWave.scheduledEnd}
                  className="px-4 py-2 text-xs font-bold text-white rounded-lg"
                  style={{ background: chainSaving === "schedule" || !editWave.scheduledStart || !editWave.scheduledEnd ? "#9bafc5" : "#41afeb" }}>
                  {chainSaving === "schedule" ? "Submitting…" : "Push Schedule to Chain"}
                </button>
              </div>
            ) : null;
          })()}

          {/* Set Price On-Chain */}
          {editWave.waveNumber > 1 && !editWave.waveClosed && (
            editWave.priceLocked ? (
              <div className="px-4 py-3 rounded-xl text-xs" style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
                Price locked — first sale has already occurred. No further price changes allowed.
              </div>
            ) : (
              <div className="space-y-3 p-4 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                <p className="text-xs font-bold" style={{ color: "#24315f" }}>Set Wave Price On-Chain</p>
                <p className="text-xs" style={{ color: "#9bafc5" }}>Only allowed before the first sale in this wave.</p>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label style={labelStyle}>Price (ETH)</label>
                    <input type="number" step="0.0001" min="0" value={chainPrice}
                      onChange={e => setChainPrice(e.target.value)} style={inputStyle} />
                  </div>
                  <button
                    onClick={() => {
                      console.log("[WaveManageModal] Set Price On-Chain — waveNumber:", editWave.waveNumber, "price:", chainPrice);
                      handleSetPriceOnChain();
                    }}
                    disabled={chainSaving === "price"}
                    className="px-4 py-2 text-xs font-bold text-white rounded-lg flex-shrink-0"
                    style={{ background: chainSaving === "price" ? "#9bafc5" : "#41afeb" }}>
                    {chainSaving === "price" ? "Submitting…" : "Set Price"}
                  </button>
                </div>
              </div>
            )
          )}

          {/* Unsold NFT Strategy */}
          <div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: "#374151" }}>
              Unsold NFT Strategy
            </label>
            <p className="text-[11px] mb-2.5" style={{ color: "#9bafc5" }}>
              Determines what happens to unsold NFTs when this wave is revealed. Must be set before reveal.
            </p>
            <div className="flex gap-2">
              <button
                disabled={!!editWave.waveRevealed}
                onClick={() => !editWave.waveRevealed && setForm(f => ({ ...f, unsoldStrategy: "auto_treasury" }))}
                className="flex-1 flex flex-col gap-1 px-3 py-2.5 rounded-xl text-left transition-all"
                style={{
                  border: `1.5px solid ${form.unsoldStrategy === "auto_treasury" ? "#41afeb" : "#e5e7eb"}`,
                  background: form.unsoldStrategy === "auto_treasury" ? "rgba(65,175,235,0.06)" : "white",
                  opacity: editWave.waveRevealed ? 0.5 : 1,
                  cursor: editWave.waveRevealed ? "not-allowed" : "pointer",
                }}>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                    style={{ borderColor: form.unsoldStrategy === "auto_treasury" ? "#41afeb" : "#d1d5db" }}>
                    {form.unsoldStrategy === "auto_treasury" && (
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#41afeb" }} />
                    )}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: "#24315f" }}>Auto → Treasury Wallet</span>
                </div>
                <p className="text-[10px] ml-5" style={{ color: "#9bafc5" }}>
                  Unsold NFTs automatically transfer to the treasury wallet as part of the reveal process. No extra admin action needed.
                </p>
              </button>
              <button
                disabled={!!editWave.waveRevealed}
                onClick={() => !editWave.waveRevealed && setForm(f => ({ ...f, unsoldStrategy: "manual" }))}
                className="flex-1 flex flex-col gap-1 px-3 py-2.5 rounded-xl text-left transition-all"
                style={{
                  border: `1.5px solid ${form.unsoldStrategy === "manual" ? "#d97706" : "#e5e7eb"}`,
                  background: form.unsoldStrategy === "manual" ? "rgba(217,119,6,0.05)" : "white",
                  opacity: editWave.waveRevealed ? 0.5 : 1,
                  cursor: editWave.waveRevealed ? "not-allowed" : "pointer",
                }}>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                    style={{ borderColor: form.unsoldStrategy === "manual" ? "#d97706" : "#d1d5db" }}>
                    {form.unsoldStrategy === "manual" && (
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#d97706" }} />
                    )}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: "#24315f" }}>Manual Transfer</span>
                </div>
                <p className="text-[10px] ml-5" style={{ color: "#9bafc5" }}>
                  Reveal runs for sold NFTs only. Admin manually moves unsold NFTs to treasury or a custom wallet using &ldquo;Move to Wallet&rdquo;.
                </p>
              </button>
            </div>
            {editWave.waveRevealed && (
              <p className="text-[10px] mt-1.5" style={{ color: "#9bafc5" }}>
                Strategy is locked — this wave has already been revealed.
              </p>
            )}
          </div>

          {/* Whitelist Restriction */}
          {editWave.waveNumber > 1 && (
            <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ border: "1px solid #e5e7eb", background: "#f9fafb" }}>
              <div>
                <p className="text-xs font-bold" style={{ color: "#374151" }}>Restrict to Whitelist</p>
                <p className="text-[10px] mt-0.5" style={{ color: "#9bafc5" }}>
                  When enabled, only admin-approved wallets can mint in this wave.
                </p>
              </div>
              <button
                onClick={() => setForm(f => ({ ...f, whitelistRequired: !f.whitelistRequired }))}
                className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0"
                style={{ background: form.whitelistRequired ? "#41afeb" : "#d1d5db" }}>
                <span className="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow"
                  style={{ transform: form.whitelistRequired ? "translateX(18px)" : "translateX(2px)" }} />
              </button>
            </div>
          )}

          {/* ── Reveal Strategy ── */}
          <div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: "#374151" }}>
              Reveal Strategy
            </label>
            <p className="text-[11px] mb-2.5" style={{ color: "#9bafc5" }}>
              Controls whether reveal fires automatically at the scheduled time or only when you manually trigger it.
            </p>
            <div className="flex gap-2">
              {/* Auto Reveal */}
              <button
                disabled={!!editWave.waveRevealed || !!editWave.waveRevealTriggered}
                onClick={() => !editWave.waveRevealed && !editWave.waveRevealTriggered && setForm(f => ({ ...f, revealStrategy: "auto" }))}
                className="flex-1 flex flex-col gap-1 px-3 py-2.5 rounded-xl text-left transition-all"
                style={{
                  border: `1.5px solid ${form.revealStrategy === "auto" ? "#41afeb" : "#e5e7eb"}`,
                  background: form.revealStrategy === "auto" ? "rgba(65,175,235,0.06)" : "white",
                  opacity: editWave.waveRevealed || editWave.waveRevealTriggered ? 0.5 : 1,
                  cursor: editWave.waveRevealed || editWave.waveRevealTriggered ? "not-allowed" : "pointer",
                }}>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                    style={{ borderColor: form.revealStrategy === "auto" ? "#41afeb" : "#d1d5db" }}>
                    {form.revealStrategy === "auto" && (
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#41afeb" }} />
                    )}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: "#24315f" }}>Auto Reveal</span>
                </div>
                <p className="text-[10px] ml-5" style={{ color: "#9bafc5" }}>
                  System automatically reveals this wave at the scheduled reveal date. No admin action needed.
                </p>
              </button>
              {/* Manual Reveal */}
              <button
                disabled={!!editWave.waveRevealed || !!editWave.waveRevealTriggered}
                onClick={() => !editWave.waveRevealed && !editWave.waveRevealTriggered && setForm(f => ({ ...f, revealStrategy: "manual" }))}
                className="flex-1 flex flex-col gap-1 px-3 py-2.5 rounded-xl text-left transition-all"
                style={{
                  border: `1.5px solid ${form.revealStrategy === "manual" ? "#7c3aed" : "#e5e7eb"}`,
                  background: form.revealStrategy === "manual" ? "rgba(124,58,237,0.05)" : "white",
                  opacity: editWave.waveRevealed || editWave.waveRevealTriggered ? 0.5 : 1,
                  cursor: editWave.waveRevealed || editWave.waveRevealTriggered ? "not-allowed" : "pointer",
                }}>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                    style={{ borderColor: form.revealStrategy === "manual" ? "#7c3aed" : "#d1d5db" }}>
                    {form.revealStrategy === "manual" && (
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#7c3aed" }} />
                    )}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: "#24315f" }}>Manual Reveal</span>
                </div>
                <p className="text-[10px] ml-5" style={{ color: "#9bafc5" }}>
                  Auto-trigger is skipped even if a reveal date is set. Admin must click &quot;Reveal Now&quot; in the Waves table to reveal.
                </p>
              </button>
            </div>
            {(editWave.waveRevealed || editWave.waveRevealTriggered) && (
              <p className="text-[10px] mt-1.5" style={{ color: "#9bafc5" }}>
                Strategy is locked — this wave&apos;s reveal is already in progress or complete.
              </p>
            )}
          </div>

          {/* ── Reveal Status (contextual, below strategy) ── */}
          {editWave.waveRevealed ? (
            <div className="px-4 py-3 rounded-xl text-xs flex items-center gap-2"
              style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.3)", color: "#16a34a" }}>
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              This wave has been revealed
            </div>
          ) : form.revealStrategy === "manual" ? (
            <div className="px-4 py-3 rounded-xl text-xs flex items-center gap-2"
              style={{ background: "rgba(124,58,237,0.05)", border: "1px solid rgba(124,58,237,0.2)", color: "#7c3aed" }}>
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Manual mode — auto-trigger will skip this wave. Use &quot;Reveal Now&quot; in the Waves table when ready.
            </div>
          ) : (
            <div className="px-4 py-3 rounded-xl text-xs flex items-center gap-2"
              style={{ background: "rgba(65,175,235,0.05)", border: "1px solid rgba(65,175,235,0.2)", color: "#2e9fd8" }}>
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {editWave.revealScheduledAt
                ? `Auto-reveal scheduled for ${new Date(editWave.revealScheduledAt).toLocaleString()}`
                : `Auto mode — set a reveal date via the "Set Date" button in the Waves table`}
            </div>
          )}

          {/* ── Reveal Metadata URI (required for Auto Reveal) ── */}
          {form.revealStrategy === "auto" && !editWave.waveRevealed && !editWave.waveRevealTriggered && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold block" style={{ color: "#374151" }}>
                Metadata Base URI <span style={{ color: "#dc2626" }}>*</span>
                <span className="ml-1 text-[10px] font-normal" style={{ color: "#9bafc5" }}>(required for auto-reveal)</span>
              </label>
              <input
                value={form.revealUri}
                onChange={e => setForm(f => ({ ...f, revealUri: e.target.value }))}
                placeholder="ipfs://QmXxx.../metadata/"
                className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                style={{
                  border: `1px solid ${form.revealUri && !form.revealUri.startsWith("ipfs://") ? "#fca5a5" : "#e5e7eb"}`,
                  fontFamily: "monospace", color: "#111827",
                }}
              />
              {form.revealUri && !form.revealUri.startsWith("ipfs://") && (
                <p className="text-[10px]" style={{ color: "#dc2626" }}>URI must start with ipfs://</p>
              )}
              <p className="text-[10px]" style={{ color: "#9bafc5" }}>
                The IPFS base URI for revealed metadata. Auto-trigger will use this at reveal time.
              </p>
            </div>
          )}

          {/* ── Per-Wave Purchase Limit ── */}
          {editWave.waveNumber > 1 && (
            <div className="space-y-3 p-4 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold" style={{ color: "#24315f" }}>Per-Wave Purchase Limit</p>
                  <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
                    Caps how many NFTs one wallet can buy in <strong>this wave</strong>.
                    Set to 0 to use the global limit from Contract Operations.
                  </p>
                </div>
                {chainOnChain?.purchaseLimit != null && (
                  <div className="flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold"
                    style={{
                      background: chainOnChain.purchaseLimit > 0 ? "rgba(65,175,235,0.1)" : "#f3f4f6",
                      color: chainOnChain.purchaseLimit > 0 ? "#41afeb" : "#9bafc5",
                      border: `1px solid ${chainOnChain.purchaseLimit > 0 ? "rgba(65,175,235,0.3)" : "#e5e7eb"}`,
                    }}>
                    On-chain: {chainOnChain.purchaseLimit > 0 ? `${chainOnChain.purchaseLimit} / wallet` : "Global limit"}
                  </div>
                )}
              </div>
              {editWave.waveRevealed ? (
                <div className="px-3 py-2 rounded-lg text-xs" style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
                  Wave revealed — purchase limit cannot be changed.
                </div>
              ) : (
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label style={labelStyle}>Max per wallet (0 = use global)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={purchaseLimitInput}
                      onChange={e => setPurchaseLimitInput(e.target.value)}
                      style={inputStyle}
                      placeholder="0 = global limit" />
                  </div>
                  <button
                    onClick={handleSetPurchaseLimitOnChain}
                    disabled={chainSaving === "purchase-limit"}
                    className="px-4 py-2 text-xs font-bold text-white rounded-lg flex-shrink-0"
                    style={{ background: chainSaving === "purchase-limit" ? "#9bafc5" : "#41afeb" }}>
                    {chainSaving === "purchase-limit" ? "Submitting…" : "Set On-Chain"}
                  </button>
                </div>
              )}
              {chainOnChain?.purchaseLimit != null && chainOnChain.purchaseLimit > 0 && (
                <p className="text-[10px]" style={{ color: "#9bafc5" }}>
                  Global purchase limit is bypassed for this wave — wallets are capped at {chainOnChain.purchaseLimit} NFT{chainOnChain.purchaseLimit !== 1 ? "s" : ""} here.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: "1px solid #e5e7eb" }}>
          <button onClick={closeManage} className="px-4 py-2 text-sm font-medium rounded-lg"
            style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Close</button>
          {(!editWave.waveClosed || !editWave.waveRevealed) && (
            <button
              onClick={() => {
                console.log("[WaveManageModal] Save Settings — waveNumber:", editWave.waveNumber, "form:", form);
                handleSave();
              }}
              disabled={saving}
              className="px-4 py-2 text-sm font-bold text-white rounded-lg"
              style={{ background: saving ? "#9bafc5" : "#41afeb" }}>
              {saving ? "Saving…" : "Save Settings"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
