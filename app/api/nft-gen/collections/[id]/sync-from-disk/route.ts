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

  const layers = scanLayers();

  if (!layers.length) {
    return NextResponse.json({ error: "No layers found on disk." }, { status: 404 });
  }

  const results: { layerName: string; traitsCreated: number; layerId: string | null }[] = [];

  for (const layer of layers) {
    const layerData = await apiPost(token, `/api/nft-gen/collections/${collectionId}/layers`, {
      name: layer.folder,
      displayName: layer.label,
      sortOrder: null,
      layerRarityPct: (layer as any).optional ? 80 : 100,
    });

    const layerId: string | null =
      layerData?.layer?.id ?? layerData?.id ?? null;

    if (!layerId) {
      results.push({ layerName: layer.folder, traitsCreated: 0, layerId: null });
      continue;
    }

    const realAssets = layer.assets.filter((a: any) => a.rel !== null);
    let traitsCreated = 0;

    for (let i = 0; i < realAssets.length; i += 5) {
      const batch = realAssets.slice(i, i + 5);
      await Promise.all(batch.map(async (asset: any) => {
        const r = await apiPost(token, `/api/nft-gen/layers/${layerId}/traits`, {
          name: asset.name,
          filePath: asset.rel,
          rarityTier: inferTier(asset.stem),
          storageProvider: "local",
        });
        if (r?.trait?.id ?? r?.id) traitsCreated++;
      }));
    }

    results.push({ layerName: layer.folder, traitsCreated, layerId });
  }

  return NextResponse.json({
    collectionId,
    layersSynced: results.filter(r => r.layerId).length,
    results,
  });
}
