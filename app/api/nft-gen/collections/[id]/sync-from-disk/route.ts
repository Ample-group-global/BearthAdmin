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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: collectionId } = await params;
  const token = getSessionToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const diskLayers = scanLayers();
  if (!diskLayers.length) {
    return NextResponse.json({ error: "No layers found on disk." }, { status: 404 });
  }

  const results: {
    layerName: string;
    layerId: string | null;
    traitsUpserted: number;
    traitsDeactivated: number;
  }[] = [];

  // ── Step 1: Upsert each layer + its traits ──────────────────────────────────
  for (const diskLayer of diskLayers) {
    // Upsert layer — ON CONFLICT preserves user-configured weights/sort/rarity
    const layerData = await apiPost(token, `/api/nft-gen/collections/${collectionId}/layers`, {
      name:             diskLayer.folder,
      displayName:      diskLayer.label,
      layerRarityPct:   (diskLayer as any).optional ? 80 : 100,
    });

    const layerId: string | null = layerData?.layer?.id ?? layerData?.id ?? null;
    if (!layerId) {
      results.push({ layerName: diskLayer.folder, layerId: null, traitsUpserted: 0, traitsDeactivated: 0 });
      continue;
    }

    const realAssets = diskLayer.assets.filter((a: any) => a.rel !== null);
    const activeFilePaths: string[] = realAssets.map((a: any) => a.rel as string);

    // Upsert traits in batches of 5 — ON CONFLICT preserves rarity_weight/tier
    let traitsUpserted = 0;
    for (let i = 0; i < realAssets.length; i += 5) {
      const batch = realAssets.slice(i, i + 5);
      await Promise.all(batch.map(async (asset: any) => {
        const r = await apiPost(token, `/api/nft-gen/layers/${layerId}/traits`, {
          name:            asset.name,
          filePath:        asset.rel,
          rarityTier:      inferTier(asset.stem),
          storageProvider: "local",
        });
        if (r?.trait?.id ?? r?.id) traitsUpserted++;
      }));
    }

    // Soft-delete traits that are no longer on disk for this layer
    const reconcileTraits = await apiPost(
      token,
      `/api/nft-gen/layers/${layerId}/traits/reconcile`,
      { activeFilePaths }
    );

    results.push({
      layerName:        diskLayer.folder,
      layerId,
      traitsUpserted,
      traitsDeactivated: reconcileTraits?.deactivated ?? 0,
    });
  }

  // ── Step 2: Soft-delete layers no longer on disk ────────────────────────────
  const diskLayerNames = diskLayers.map((l) => l.folder);
  const reconcileLayers = await apiPost(
    token,
    `/api/nft-gen/collections/${collectionId}/layers/reconcile`,
    { activeNames: diskLayerNames }
  );

  return NextResponse.json({
    collectionId,
    layersSynced:     results.filter((r) => r.layerId).length,
    layersDeactivated: reconcileLayers?.deactivated ?? 0,
    results,
  });
}
