import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "../../../../../../lib/api-proxy";
import { scanLayers } from "../../../../../../lib/studio/layers";

export const dynamic = "force-dynamic";

const API_BASE = process.env.BEARTH_API_URL!;

async function apiPost(token: string, path: string, body: unknown) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.ok ? await r.json() : null;
}

function inferTier(stem: string): string {
  const s = stem.toLowerCase();
  if (s.includes("legendary")) return "legendary";
  if (s.includes("epic"))      return "epic";
  if (s.includes("rare"))      return "rare";
  return "common";
}

interface ManifestAsset { stem: string; name?: string; rel?: string | null; defaultWeight?: number; }
interface ManifestLayer { folder: string; label?: string; count?: number; optional?: boolean; assets: ManifestAsset[]; }

async function syncLayerManifest(
  token: string,
  collectionId: string,
  manifest: ManifestLayer[]
) {
  const results = await Promise.all(manifest.map(async (ml) => {
    const realAssets = ml.assets.filter((a) => !!a.rel);
    if (!realAssets.length) return { layerName: ml.folder, layerId: null, traitsUpserted: 0, traitsDeactivated: 0 };

    const layerData = await apiPost(token, `/api/nft-gen/collections/${collectionId}/layers`, {
      name:           ml.folder,
      displayName:    ml.label ?? ml.folder,
      layerRarityPct: ml.optional ? 80 : 100,
    });
    const layerId: string | null = layerData?.layer?.id ?? layerData?.id ?? null;
    if (!layerId) return { layerName: ml.folder, layerId: null, traitsUpserted: 0, traitsDeactivated: 0 };

    const activeFilePaths = realAssets.map((a) => a.rel as string);
    let traitsUpserted = 0;
    const BATCH = 50;
    for (let i = 0; i < realAssets.length; i += BATCH) {
      await Promise.all(realAssets.slice(i, i + BATCH).map(async (asset) => {
        const r = await apiPost(token, `/api/nft-gen/layers/${layerId}/traits`, {
          name:            asset.name ?? asset.stem,
          filePath:        asset.rel,
          rarityTier:      inferTier(asset.stem),
          storageProvider: "filebase",
        });
        if (r?.trait?.id ?? r?.id) traitsUpserted++;
      }));
    }

    const reconcileTraits = await apiPost(token, `/api/nft-gen/layers/${layerId}/traits/reconcile`, { activeFilePaths });
    return { layerName: ml.folder, layerId, traitsUpserted, traitsDeactivated: reconcileTraits?.deactivated ?? 0 };
  }));

  const reconcileLayers = await apiPost(token, `/api/nft-gen/collections/${collectionId}/layers/reconcile`, {
    activeNames: manifest.map((l) => l.folder),
  });

  return {
    collectionId,
    layersSynced:      results.filter((r) => r.layerId).length,
    layersDeactivated: reconcileLayers?.deactivated ?? 0,
    results,
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: collectionId } = await params;
  const token = getSessionToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const diskLayers = scanLayers();

  if (diskLayers.length) {
    // Local dev — sync from BearthAdmin disk
    const data = await syncLayerManifest(token, collectionId, diskLayers);
    return NextResponse.json(data);
  }

  // On Vercel there is no local disk. Try the manifest passed from the client (parsed
  // in React state) first — this is always available immediately after the user drops
  // their folder. Fall back to BearthApi's own disk scan if no manifest was sent.
  let body: { layers?: ManifestLayer[] } = {};
  try { body = await req.json(); } catch { /* body may be empty */ }

  if (body.layers?.length) {
    const data = await syncLayerManifest(token, collectionId, body.layers);
    return NextResponse.json(data);
  }

  // Last resort: ask BearthApi to scan its own LAYERS_DIR (layers uploaded to Railway disk)
  const r = await fetch(`${API_BASE}/api/nft-gen/collections/${collectionId}/sync-from-api-layers`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const data = await r.json();
  return NextResponse.json(data, { status: r.status });
}
