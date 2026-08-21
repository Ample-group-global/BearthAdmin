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

async function syncOneLayer(token: string, collectionId: string, ml: ManifestLayer, layerIdx: number) {
  const realAssets = ml.assets.filter((a) => !!a.rel);
  if (!realAssets.length) return { layerName: ml.folder, layerId: null, traitsUpserted: 0, traitsDeleted: 0 };

  // sortOrder is explicit per layer, so layers no longer need to be created in
  // request order — each layer's row lands at the right position in the list
  // regardless of which request happens to resolve first.
  const layerData = await apiPost(token, `/api/nft-gen/collections/${collectionId}/layers`, {
    name:           ml.folder,
    displayName:    ml.label ?? ml.folder,
    layerRarityPct: ml.optional ? 80 : 100,
    sortOrder:      layerIdx,
  });
  const layerId: string | null = layerData?.layer?.id ?? layerData?.id ?? null;
  if (!layerId) return { layerName: ml.folder, layerId: null, traitsUpserted: 0, traitsDeleted: 0 };

  const activeFilePaths = realAssets.map((a) => a.rel as string);
  // One bulk call per layer instead of one HTTP round-trip per trait — BearthApi
  // holds a single DB connection for the whole layer and inserts in one set-based
  // query, instead of this route opening up to 50 concurrent HTTP+DB round-trips
  // that used to starve the 10-connection pool (confirmed live 2026-08-17: a
  // 213-trait upload crashed BearthApi that way).
  const bulkResp = await apiPost(token, `/api/nft-gen/layers/${layerId}/traits/bulk`, {
    traits: realAssets.map((asset) => ({
      name:            asset.stem,
      filePath:        asset.rel,
      rarityTier:      inferTier(asset.stem),
      storageProvider: "filebase",
    })),
  });
  const traitsUpserted = bulkResp?.count ?? 0;

  const reconcileTraits = await apiPost(token, `/api/nft-gen/layers/${layerId}/traits/reconcile`, { activeFilePaths });
  return { layerName: ml.folder, layerId, traitsUpserted, traitsDeleted: reconcileTraits?.deactivated ?? 0 };
}

async function syncLayerManifest(
  token: string,
  collectionId: string,
  manifest: ManifestLayer[]
) {
  // Layers run with bounded concurrency instead of one-at-a-time — each layer
  // is now just 3 quick calls (create, bulk-upsert traits, reconcile), so a
  // handful running together stays well under the DB pool's 10-connection cap
  // while cutting total sync time roughly by the concurrency factor.
  const CONCURRENCY = 4;
  const results: Array<{ layerName: string; layerId: string | null; traitsUpserted: number; traitsDeleted: number }> = new Array(manifest.length);
  for (let i = 0; i < manifest.length; i += CONCURRENCY) {
    const batch = manifest.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map((ml, j) => syncOneLayer(token, collectionId, ml, i + j)));
    batchResults.forEach((r, j) => { results[i + j] = r; });
  }

  const reconcileLayers = await apiPost(token, `/api/nft-gen/collections/${collectionId}/layers/reconcile`, {
    activeNames: manifest.map((l) => l.folder),
  });

  return {
    collectionId,
    layersSynced:  results.filter((r) => r.layerId).length,
    layersDeleted: reconcileLayers?.deactivated ?? 0,
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
