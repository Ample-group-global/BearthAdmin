import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "../../../../../../lib/api-proxy";

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
  // Process layers sequentially to preserve folder order (0-bg, 1-back, 2-body, …)
  // Promise.all would insert in random order because requests resolve at different times.
  const results: Array<{ layerName: string; layerId: string | null; traitsUpserted: number; traitsDeactivated: number }> = [];
  for (let layerIdx = 0; layerIdx < manifest.length; layerIdx++) {
    const ml = manifest[layerIdx];
    const realAssets = ml.assets.filter((a) => !!a.rel);
    if (!realAssets.length) { results.push({ layerName: ml.folder, layerId: null, traitsUpserted: 0, traitsDeactivated: 0 }); continue; }

    const layerData = await apiPost(token, `/api/nft-gen/collections/${collectionId}/layers`, {
      name:           ml.folder,
      displayName:    ml.label ?? ml.folder,
      layerRarityPct: ml.optional ? 80 : 100,
      sortOrder:      layerIdx,
    });
    const layerId: string | null = layerData?.layer?.id ?? layerData?.id ?? null;
    if (!layerId) { results.push({ layerName: ml.folder, layerId: null, traitsUpserted: 0, traitsDeactivated: 0 }); continue; }

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
    results.push({ layerName: ml.folder, layerId, traitsUpserted, traitsDeactivated: reconcileTraits?.deactivated ?? 0 });
  }

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
  try {
    const { id: collectionId } = await params;
    const token = getSessionToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: { layers?: ManifestLayer[] } = {};
    try { body = await req.json(); } catch { /* body may be empty */ }

    if (!body.layers?.length) {
      return NextResponse.json({
        error: "No layer manifest provided — drag and drop your assets folder in the Settings tab before syncing.",
      }, { status: 422 });
    }

    const data = await syncLayerManifest(token, collectionId, body.layers);
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sync-from-disk] unhandled:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
