'use client';
import './studio.css';
import { useState, useEffect, useCallback } from 'react';
import StepNav from './components/StepNav';
import CollectionSetup from './components/CollectionSetup';
import Sidebar from './components/Sidebar';
import LayerContent from './components/LayerContent';
import PreviewPanel from './components/PreviewPanel';
import ExportPanel from './components/ExportPanel';
import RarityModal from './components/RarityModal';
import RarityTab from './components/RarityTab';
import { LayerFilesProvider } from './LayerFilesContext';

interface LayerAsset { id?: string; stem: string; defaultWeight?: number; rel?: string; }
interface Layer { id?: string; folder: string; count: number; assets: LayerAsset[]; optional?: boolean; }
type Weights = Record<string, Record<string, number>>;
type ConflictRule = Record<string, unknown>;

const DEFAULT_COLLECTION = {
  name: '',
  symbol: '',
  description: '',
  supply: undefined as number | undefined,
  blockchain: 'ethereum',
  format: 'png',
  nameFormat: '#{{id}}',
  width: undefined as number | undefined,
  height: undefined as number | undefined,
};

export default function Page() {
  const [step, setStep] = useState('settings');
  const [collection, setCollection] = useState(DEFAULT_COLLECTION);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [sessionRestored, setSessionRestored] = useState(false);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [weights, setWeights] = useState<Weights>({});
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [gearFolder, setGearFolder] = useState<string | null>(null);
  const [gearFocusStem, setGearFocusStem] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictRule[]>([]);

  // Single entry point for the layer modal — used by the sidebar gear icon,
  // the Advanced view's own "Layer Rarity" button, and clicking an individual
  // trait card. Previously each of those opened a different popup (or, for
  // the Advanced-view button, an under-propped copy of this same one missing
  // Layer Metadata/Rules); now there's exactly one modal, optionally scrolled
  // to a specific trait when opened from a card click.
  function openLayerModal(folder: string, focusStem?: string) {
    setGearFolder(folder);
    setGearFocusStem(focusStem ?? null);
  }

  function goToStep(newStep: string) {
    if (step !== 'organize' && newStep === 'organize') {
      const best = layers.find(l => l.count > 1) ?? layers[0];
      setActiveFolder(best?.folder ?? null);
    }
    setStep(newStep);
  }

  const loadLayers = useCallback((localLayers?: Layer[], cid?: string | null) => {
    const applyLayers = (data: Layer[]) => {
      setLayers(data);
      setWeights(prev => {
        const updated = { ...prev };
        data.forEach(l => {
          updated[l.folder] = Object.fromEntries(
            l.assets.map((a: LayerAsset) => [a.stem, a.defaultWeight ?? 1])
          );
        });
        return updated;
      });
      if (data.length && !activeFolder) {
        const best = data.find(l => l.count > 1) ?? data[0];
        setActiveFolder(best.folder);
      }
    };

    if (localLayers?.length) {
      applyLayers(localLayers);
      return;
    }

    const effectiveCid = cid ?? collectionId;
    if (!effectiveCid) return; // no upload and no saved collection — Organise stays empty

    fetch(`/api/layers?collectionId=${effectiveCid}`)
      .then(r => r.json())
      .then((data: Layer[]) => { if (data.length) applyLayers(data); })
      .catch(() => { /* layers load silently — page shows empty state */ });
  }, [activeFolder, collectionId]);

  useEffect(() => {
    // Conflicts and weights now live on the collection/trait rows in the DB —
    // both get picked up below from the same collection-detail fetches that
    // already run to restore name/symbol/supply/etc.
    fetch('/api/session/collection').then(r => r.json()).catch(() => ({})).then((sessionData) => {
      const savedId: string | null = sessionData?.collectionId ?? null;
      loadLayers(undefined, savedId || undefined);

      if (savedId) {
        setCollectionId(savedId);
        setSessionRestored(true);
        const s = sessionData?.supply;
        if (s && s > 0) setCollection(prev => ({ ...prev, supply: s }));
        fetch(`/api/nft-gen/collections/${savedId}`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            const c = data?.collection ?? data;
            if (!c?.id) return;
            setCollection(prev => ({
              ...prev,
              name:        c.name        ?? prev.name,
              description: c.description ?? prev.description,
              symbol:      c.symbol      ?? prev.symbol,
              blockchain:  c.network ?? 'ethereum',
              width:       c.formatWidth  ?? prev.width,
              height:      c.formatHeight ?? prev.height,
              supply:      c.supply       ?? prev.supply,
              nameFormat:  c.nameFormat   ?? prev.nameFormat,
              format:      c.formatType   ?? prev.format,
            }));
            if (Array.isArray(c.conflictRules)) setConflicts(c.conflictRules);
          })
          .catch(() => {});
      } else {
        // No session cookie (e.g. incognito) — restore from most recent collection in DB
        fetch('/api/nft-gen/collections?limit=1')
          .then(r => r.ok ? r.json() : null)
          .then(async data => {
            const first = (data?.collections ?? data)?.[0] ?? null;
            if (!first?.id) return;
            setCollectionId(first.id);
            setSessionRestored(true);
            loadLayers(undefined, first.id);
            fetch('/api/session/collection', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ collectionId: first.id, name: first.name }),
            }).catch(() => {});
            // Fetch full record so supply/nameFormat/formatType are loaded
            const fullResp = await fetch(`/api/nft-gen/collections/${first.id}`).catch(() => null);
            if (!fullResp?.ok) return;
            const fullData = await fullResp.json().catch(() => null);
            const c = fullData?.collection ?? fullData;
            if (!c?.id) return;
            setCollection(prev => ({
              ...prev,
              name:        c.name        ?? prev.name,
              description: c.description ?? prev.description,
              symbol:      c.symbol      ?? prev.symbol,
              blockchain:  c.network ?? 'ethereum',
              width:       c.formatWidth  ?? prev.width,
              height:      c.formatHeight ?? prev.height,
              supply:      c.supply       ?? prev.supply,
              nameFormat:  c.nameFormat   ?? prev.nameFormat,
              format:      c.formatType   ?? prev.format,
            }));
            if (Array.isArray(c.conflictRules)) setConflicts(c.conflictRules);
          })
          .catch(() => {});
      }
    });
  }, []);

  const handleWeightChange = useCallback((folder: string, stem: string, value: number) => {
    setWeights(prev => ({ ...prev, [folder]: { ...prev[folder], [stem]: value } }));

    // Weight lives on the trait row itself now — find its id and persist there.
    const traitId = layers.find(l => l.folder === folder)?.assets.find((a: LayerAsset) => a.stem === stem)?.id;
    if (!traitId) {
      // Layers state hasn't caught up with what's on screen yet — don't pretend the
      // edit was saved. Revert the optimistic update so the UI never shows a value
      // that was never persisted.
      setWeights(prev => {
        const original = layers.find(l => l.folder === folder)?.assets.find((a: LayerAsset) => a.stem === stem)?.defaultWeight;
        if (original == null) return prev;
        return { ...prev, [folder]: { ...prev[folder], [stem]: original } };
      });
      console.error(`Rarity weight edit for "${stem}" in "${folder}" could not be saved — trait not found yet. Please try again.`);
      return;
    }
    fetch(`/api/nft-gen/traits/${traitId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        value > 0 ? { rarityWeight: Math.max(1, Math.round(value)), isActive: true } : { isActive: false }
      ),
    }).then(res => {
      if (!res.ok) throw new Error(`PUT /api/nft-gen/traits/${traitId} failed (${res.status})`);
    }).catch(err => console.error('Rarity weight save failed:', err));
  }, [layers]);

  async function saveConflicts(rules: ConflictRule[]) {
    setConflicts(rules);
    if (!collectionId) return;
    await fetch(`/api/nft-gen/collections/${collectionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conflictRules: rules }),
    }).catch(() => { });
  }

  async function handleToggleOptional(folder: string, optional: boolean) {
    const layerId = layers.find(l => l.folder === folder)?.id;
    if (!layerId) return;
    await fetch(`/api/nft-gen/layers/${layerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layerRarityPct: optional ? 80 : 100 }),
    });
    loadLayers();
  }

  async function handleSaveLayerMeta(folder: string, meta: { displayName?: string; isActive?: boolean; layerRarityPct?: number }) {
    const layerId = layers.find(l => l.folder === folder)?.id;
    if (!layerId) return;
    await fetch(`/api/nft-gen/layers/${layerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meta),
    }).catch(() => { });
    loadLayers();
  }

  async function handleRenameTrait(asset: { id?: string }, name: string) {
    if (!asset.id) return;
    await fetch(`/api/nft-gen/traits/${asset.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).catch(() => { });
    loadLayers();
  }

  // Create/update collection in DB, then sync layers from disk
  async function handleCollectionContinue() {
    setSyncing(true);
    setSyncError('');
    try {
      // Create or update collection in DB
      let cid = collectionId;
      if (!cid) {
        const r = await fetch('/api/nft-gen/collections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: collection.name,
            description: collection.description,
            symbol: collection.symbol,
            network: collection.blockchain,
            formatWidth: collection.width ?? null,
            formatHeight: collection.height ?? null,
            shuffleOutput: true,
            supply:     collection.supply,
            nameFormat: collection.nameFormat,
            formatType: collection.format,
          }),
        });
        const data = await r.json();
        cid = data?.collection?.id ?? data?.id ?? null;
        if (cid) {
          setCollectionId(cid);
          await fetch('/api/session/collection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              collectionId: cid,
              name:   collection.name,
              supply: collection.supply,
            }),
          }).catch(() => {});
        }
      } else {
        // Update existing — sync all editable fields back to DB
        await fetch(`/api/nft-gen/collections/${cid}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:         collection.name,
            description:  collection.description,
            symbol:       collection.symbol,
            network:      collection.blockchain,
            formatWidth:  collection.width  ?? null,
            formatHeight: collection.height ?? null,
            supply:       collection.supply,
            nameFormat:   collection.nameFormat,
            formatType:   collection.format,
          }),
        });
        await fetch('/api/session/collection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collectionId: cid, supply: collection.supply }),
        }).catch(() => {});
      }

      // Sync layers into DB — only when the user drag-dropped files this session.
      // With no fresh manifest, the DB already holds whatever was last synced;
      // there's no local-disk fallback to fall back to anymore.
      if (cid) {
        if (layers.length > 0) {
          const syncResp = await fetch(`/api/nft-gen/collections/${cid}/sync-from-disk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ layers }),
          });
          if (!syncResp.ok) {
            const d = await syncResp.json().catch(() => ({}));
            throw new Error(d.error ?? 'Layer sync failed — please check your connection and try again.');
          }
        }
        loadLayers(undefined, cid);

        // Re-fetch collection from DB so form reflects what was actually stored
        fetch(`/api/nft-gen/collections/${cid}`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            const c = data?.collection ?? data;
            if (!c?.id) return;
            setCollection(prev => ({
              ...prev,
              name:        c.name        ?? prev.name,
              description: c.description ?? prev.description,
              symbol:      c.symbol      ?? prev.symbol,
              blockchain:  c.network ?? prev.blockchain,
              width:       c.formatWidth  ?? prev.width,
              height:      c.formatHeight ?? prev.height,
              supply:      c.supply       ?? prev.supply,
              nameFormat:  c.nameFormat   ?? prev.nameFormat,
              format:      c.formatType   ?? prev.format,
            }));
          })
          .catch(() => {});
      }

      goToStep('organize');
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : 'Failed to create collection');
    } finally {
      setSyncing(false);
    }
  }

  function resetCollection() {
    setCollection(DEFAULT_COLLECTION);
    setCollectionId(null);
    setSessionRestored(false);
    setSyncError('');
    setLayers([]);
    fetch('/api/session/collection', { method: 'DELETE' }).catch(() => {});
    fetch('/api/nft-gen/layers/clear-bucket', { method: 'POST' }).catch(() => {});
  }

  const activeLayer = layers.find(l => l.folder === activeFolder) ?? null;

  return (
    <LayerFilesProvider>
      <div className="studio-wrap">
        {/* ── Header ── */}
        <header className="header">
          <div className="logo">🐻 Bearth <span>NFT Studio</span></div>
          <StepNav step={step} onStep={goToStep} />
          <div style={{ minWidth: 120 }} />
        </header>

        {/* ── Step 1: Settings ── */}
        {step === 'settings' && (
          <CollectionSetup
            collection={collection}
            onChange={setCollection}
            onNext={handleCollectionContinue}
            onReset={resetCollection}
            onLayersChange={loadLayers}
            syncing={syncing}
            syncError={syncError}
            sessionRestored={sessionRestored}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            collectionId={collectionId as any}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onDismissRestore={(() => setSessionRestored(false)) as any}
          />
        )}

        {/* ── Step 2: Organize ── */}
        {step === 'organize' && (
          <div className="org-layout">
            <Sidebar
              layers={layers}
              collectionId={collectionId}
              activeFolder={activeFolder}
              onSelect={setActiveFolder}
              onLayersChange={loadLayers}
              onGearClick={openLayerModal}
              onToggleOptional={handleToggleOptional}
              onReorder={(newFolderOrder: string[]) => {
                // Apply the user's drag order immediately in state — no refetch.
                // Refetching would re-sort numerically and undo the drag.
                const map = new Map(layers.map(l => [l.folder, l]));
                const reordered = newFolderOrder.map(f => map.get(f)).filter(Boolean) as Layer[];
                setLayers(reordered);

                const items = reordered
                  .map((l, i) => ({ id: l.id, sortOrder: i }))
                  .filter((i): i is { id: string; sortOrder: number } => !!i.id);
                if (!items.length || !collectionId) return;
                fetch(`/api/nft-gen/collections/${collectionId}/layers/reorder`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ items }),
                }).catch(() => {});
              }}
            />
            <div className="org-main">
              {layers.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--dim)', textAlign: 'center', padding: 40 }}>
                  <div style={{ fontSize: 40 }}>🗂️</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>No layers yet</div>
                  <div style={{ fontSize: 13 }}>
                    Go to <strong>Settings</strong> and drop your layers folder into the import zone to get started.
                  </div>
                  <button className="btn btn-ghost" onClick={() => goToStep('settings')} style={{ marginTop: 8 }}>
                    ← Back to Settings
                  </button>
                </div>
              ) : activeLayer ? (
                <LayerContent
                  key={activeFolder}
                  layer={activeLayer}
                  layerWeights={weights[activeFolder!] ?? {}}
                  allWeights={weights}
                  supply={collection.supply}
                  onWeightChange={handleWeightChange}
                  onLayersChange={loadLayers}
                  onGenerate={() => goToStep('preview')}
                  onOpenLayerModal={openLayerModal}
                />
              ) : (
                <div className="loading"><div className="spinner" /></div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 3: Rarity ── */}
        {/* Unreachable while StepNav's SHOW_RARITY_TAB flag is false — the nav never
            offers 'rarity' as a step, so setStep(...) can't land here. Kept (not
            deleted) so the tab can be restored by flipping that one flag. */}
        {step === 'rarity' && (
          <RarityTab
            layers={layers}
            weights={weights}
            collection={collection}
          />
        )}

        {/* ── Step 4: Preview ── */}
        {step === 'preview' && (
          <PreviewPanel
            weights={weights}
            layers={layers}
            collection={collection}
            conflicts={conflicts}
          />
        )}

        {/* ── Step 5: Export ── */}
        {step === 'export' && (
          <ExportPanel
            weights={weights}
            layers={layers as never[]}
            collection={collection}
            conflicts={conflicts}
            collectionId={collectionId as never}
          />
        )}

        {/* ── Layer gear modal (sidebar ⚙ click) ── */}
        {gearFolder && (() => {
          const gearLayer = layers.find(l => l.folder === gearFolder);
          if (!gearLayer) return null;
          return (
            <RarityModal
              layer={gearLayer}
              weights={weights[gearFolder] ?? {}}
              supply={collection.supply}
              allLayers={layers}
              conflicts={conflicts}
              focusStem={gearFocusStem}
              onSaveConflicts={saveConflicts}
              onSaveLayerMeta={(meta: { displayName?: string; layerRarityPct?: number }) => handleSaveLayerMeta(gearFolder, meta)}
              onRenameTrait={handleRenameTrait}
              onSave={(newWs: Record<string, number>) => {
                Object.entries(newWs).forEach(([stem, val]) => handleWeightChange(gearFolder, stem, val));
              }}
              onDelete={async (asset: { id?: string; rel?: string }) => {
                if (!asset.rel || !asset.id) return;
                await fetch(`/api/nft-gen/traits/${asset.id}`, { method: 'DELETE' });
                loadLayers();
              }}
              onClose={() => { setGearFolder(null); setGearFocusStem(null); }}
            />
          );
        })()}
      </div>
    </LayerFilesProvider>
  );
}
