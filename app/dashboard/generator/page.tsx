'use client';
import './studio.css';
import { useState, useEffect, useCallback } from 'react';
import StepNav         from './components/StepNav';
import CollectionSetup from './components/CollectionSetup';
import Sidebar         from './components/Sidebar';
import LayerContent    from './components/LayerContent';
import PreviewPanel    from './components/PreviewPanel';
import ExportPanel     from './components/ExportPanel';
import RarityModal     from './components/RarityModal';
import RarityTab       from './components/RarityTab';
import ConflictsPanel  from './components/ConflictsPanel';

const DEFAULT_COLLECTION = {
  name:        '',
  symbol:      '',
  description: '',
  supply:      100,
  blockchain:  'ethereum',
  format:      'png',
  nameFormat:  '#{{id}}',
  width:       undefined as number | undefined,
  height:      undefined as number | undefined,
};

export default function Page() {
  const [step,           setStep]          = useState('settings');
  const [collection,     setCollection]    = useState(DEFAULT_COLLECTION);
  const [collectionId,   setCollectionId]  = useState<string | null>(null);
  const [syncing,        setSyncing]       = useState(false);
  const [syncError,      setSyncError]     = useState('');
  const [layers,         setLayers]        = useState<any[]>([]);
  const [weights,        setWeights]       = useState<Record<string, any>>({});
  const [activeFolder,   setActiveFolder]  = useState<string | null>(null);
  const [gearFolder,     setGearFolder]    = useState<string | null>(null);
  const [conflicts,      setConflicts]     = useState<any[]>([]);
  const [showConflicts,  setShowConflicts] = useState(false);

  function goToStep(newStep: string) {
    if (step !== 'organize' && newStep === 'organize') {
      const best = layers.find(l => l.count > 1) ?? layers[0];
      setActiveFolder(best?.folder ?? null);
    }
    setStep(newStep);
  }

  const loadLayers = useCallback(() => {
    fetch('/api/layers')
      .then(r => r.json())
      .then((data: any[]) => {
        setLayers(data);
        setWeights(prev => {
          const updated = { ...prev };
          data.forEach(l => {
            if (!updated[l.folder]) {
              updated[l.folder] = Object.fromEntries(
                l.assets.map((a: any) => [a.stem, a.defaultWeight ?? 1])
              );
            }
          });
          return updated;
        });
        if (data.length && !activeFolder) {
          const best = data.find(l => l.count > 1) ?? data[0];
          setActiveFolder(best.folder);
        }
      });
  }, [activeFolder]);

  useEffect(() => {
    loadLayers();
    fetch('/api/conflicts')
      .then(r => r.json())
      .then(setConflicts)
      .catch(() => {});

    // Check if there's already a collection saved in session storage
    const savedId = sessionStorage.getItem('nft_collection_id');
    const savedName = sessionStorage.getItem('nft_collection_name');
    if (savedId && savedName) {
      setCollectionId(savedId);
      setCollection(prev => ({ ...prev, name: savedName }));
    }
  }, []);

  const handleWeightChange = useCallback((folder: string, stem: string, value: any) => {
    setWeights(prev => ({
      ...prev,
      [folder]: { ...prev[folder], [stem]: value },
    }));
  }, []);

  async function saveConflicts(rules: any[]) {
    await fetch('/api/conflicts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rules),
    });
    setConflicts(rules);
  }

  async function handleToggleOptional(folder: string, optional: boolean) {
    await fetch('/api/layers/optional', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder, optional }),
    });
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
            name:        collection.name || 'Bearth NFT Collection',
            description: collection.description,
            symbol:      collection.symbol || 'BRT',
            network:     collection.blockchain === 'solana' ? 'sol' : 'eth',
            formatWidth: collection.width  ?? 2000,
            formatHeight:collection.height ?? 2000,
            shuffleOutput: true,
          }),
        });
        const data = await r.json();
        cid = data?.collection?.id ?? data?.id ?? null;
        if (cid) {
          setCollectionId(cid);
          sessionStorage.setItem('nft_collection_id', cid);
          sessionStorage.setItem('nft_collection_name', collection.name || 'Bearth NFT Collection');
        }
      } else {
        // Update existing
        await fetch(`/api/nft-gen/collections/${cid}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:        collection.name,
            description: collection.description,
            symbol:      collection.symbol,
          }),
        });
      }

      // Sync layers from BearthLayersv1 into DB
      if (cid) {
        await fetch(`/api/nft-gen/collections/${cid}/sync-from-disk`, { method: 'POST' });
      }

      goToStep('organize');
    } catch (err: any) {
      setSyncError(err.message ?? 'Failed to create collection');
    } finally {
      setSyncing(false);
    }
  }

  function resetCollection() {
    setCollection(DEFAULT_COLLECTION);
    setCollectionId(null);
    sessionStorage.removeItem('nft_collection_id');
    sessionStorage.removeItem('nft_collection_name');
  }

  const activeLayer = layers.find(l => l.folder === activeFolder) ?? null;

  return (
    <div className="studio-wrap">
      {/* ── Header ── */}
      <header className="header">
        <div className="logo">🐻 Bearth <span>NFT Studio</span></div>
        <StepNav step={step} onStep={goToStep} />
        <div style={{ minWidth: 120, display:'flex', justifyContent:'flex-end' }}>
          {step === 'organize' && (
            <button
              className="btn btn-ghost"
              style={{ fontSize:12, display:'flex', alignItems:'center', gap:5 }}
              onClick={() => setShowConflicts(true)}
            >
              ⚡ {conflicts.length > 0 ? `Rules (${conflicts.length})` : 'Conflict Rules'}
            </button>
          )}
        </div>
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
        />
      )}

      {/* ── Step 2: Organize ── */}
      {step === 'organize' && (
        <div className="org-layout">
          <Sidebar
            layers={layers}
            activeFolder={activeFolder}
            onSelect={setActiveFolder}
            onLayersChange={loadLayers}
            onGearClick={setGearFolder}
            onToggleOptional={handleToggleOptional}
            onReorder={async (newFolderOrder: string[]) => {
              await fetch('/api/layers/order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order: newFolderOrder }),
              });
              loadLayers();
            }}
          />
          <div className="org-main">
            {layers.length === 0 ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:12, color:'var(--dim)', textAlign:'center', padding:40 }}>
                <div style={{ fontSize:40 }}>🗂️</div>
                <div style={{ fontSize:16, fontWeight:600, color:'var(--text)' }}>No layers found</div>
                <div style={{ fontSize:13 }}>
                  The layer organizer requires the <strong>BearthLayersv1</strong> folder on the same machine.<br />
                  Run the generator locally to import and organize your layers.
                </div>
                <button className="btn btn-ghost" onClick={() => goToStep('settings')} style={{ marginTop:8 }}>
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
              />
            ) : (
              <div className="loading"><div className="spinner" /></div>
            )}
          </div>
        </div>
      )}

      {/* ── Step 3: Rarity ── */}
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
          collection={collection}
          conflicts={conflicts}
          collectionId={collectionId as any}
        />
      )}

      {/* ── Conflict Rules modal ── */}
      {showConflicts && (
        <ConflictsPanel
          layers={layers}
          rules={conflicts}
          onSave={saveConflicts}
          onClose={() => setShowConflicts(false)}
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
            onSave={(newWs: any) => {
              Object.entries(newWs).forEach(([stem, val]) => handleWeightChange(gearFolder, stem, val));
            }}
            onDelete={async (asset: any) => {
              if (!asset.rel) return;
              await fetch('/api/asset/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rel: asset.rel }),
              });
              loadLayers();
            }}
            onClose={() => setGearFolder(null)}
          />
        );
      })()}
    </div>
  );
}
