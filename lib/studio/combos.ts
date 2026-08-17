// Shared client-side combo generation logic used by PreviewPanel (and the
// legacy browser-side export path).
//
// PREVIEW-ONLY, NOT AUTHORITATIVE: this reimplements the same weighted-pick
// + conflict-resolution + rarity-scoring algorithm as BearthApi's
// src/routes/nft-gen/generate.ts, which is the actual server-side path that
// persists real generation results. The two are not guaranteed to stay in
// sync — if the rarity formula or conflict logic changes on one side,
// remember to check the other. Preview's numbers are a fast local
// approximation for the Preview tab's UI, not a guarantee of what the
// server will actually generate.

export function pickWeighted(assets: any[], ws: Record<string, number>): any | null {
  const pool = assets.filter(a => (ws[a.stem] ?? a.defaultWeight ?? 1) > 0);
  if (!pool.length) return null;
  const tot = pool.reduce((s, a) => s + (ws[a.stem] ?? a.defaultWeight ?? 1), 0);
  let r = Math.random() * tot;
  for (const a of pool) {
    r -= ws[a.stem] ?? a.defaultWeight ?? 1;
    if (r <= 0) return a;
  }
  return pool[pool.length - 1];
}

export function resolveConflicts(
  picks: Record<string, any>,
  conflicts: any[],
  weights: Record<string, Record<string, number>>,
  layers: any[]
) {
  if (!conflicts?.length) return;
  const layerMap = Object.fromEntries(layers.map(l => [l.folder, l]));
  const rules = conflicts
    .map(r => ({
      type: r.type ?? 'exclude',
      ifLayer: r.ifLayer,
      ifTrait: r.ifTrait,
      thenLayer: r.thenLayer,
      thenTraits: Array.isArray(r.thenTraits) ? r.thenTraits : (r.thenTrait ? [r.thenTrait] : []),
    }))
    .filter(r => r.thenTraits.length);

  // Auto-expand exclude rules to be bidirectional — prevents asymmetric conflicts
  // "IF A=x EXCLUDE B=y" also enforces "IF B=y EXCLUDE A=x"
  const expanded: typeof rules = [];
  for (const rule of rules) {
    if (rule.type === 'exclude') {
      for (const t of rule.thenTraits) {
        const reverseExists = rules.some(r =>
          r.type === 'exclude' &&
          r.ifLayer === rule.thenLayer && r.ifTrait === t &&
          r.thenLayer === rule.ifLayer && r.thenTraits.includes(rule.ifTrait)
        );
        if (!reverseExists) {
          expanded.push({ type: 'exclude', ifLayer: rule.thenLayer, ifTrait: t, thenLayer: rule.ifLayer, thenTraits: [rule.ifTrait] });
        }
      }
    }
  }
  const allRules = [...rules, ...expanded];

  for (let pass = 0; pass < 5; pass++) {
    let changed = false;
    for (const rule of allRules) {
      if (picks[rule.ifLayer]?.stem !== rule.ifTrait) continue;
      const thenLayer = layerMap[rule.thenLayer];
      if (!thenLayer) continue;
      const ws = weights[rule.thenLayer] ?? {};
      if (rule.type === 'exclude') {
        if (!rule.thenTraits.includes(picks[rule.thenLayer]?.stem)) continue;
        const valid = thenLayer.assets.filter(
          (a: any) => !rule.thenTraits.includes(a.stem) && (ws[a.stem] ?? a.defaultWeight ?? 1) > 0
        );
        if (valid.length) {
          picks[rule.thenLayer] = pickWeighted(valid, ws);
          changed = true;
        } else {
          // All valid traits are excluded — impossible constraint, pick from full layer
          const fallback = thenLayer.assets.filter((a: any) => (ws[a.stem] ?? a.defaultWeight ?? 1) > 0);
          if (fallback.length) { picks[rule.thenLayer] = pickWeighted(fallback, ws); changed = true; }
        }
      } else {
        if (rule.thenTraits.includes(picks[rule.thenLayer]?.stem)) continue;
        const valid = thenLayer.assets.filter(
          (a: any) => rule.thenTraits.includes(a.stem) && (ws[a.stem] ?? a.defaultWeight ?? 1) > 0
        );
        if (valid.length) { picks[rule.thenLayer] = pickWeighted(valid, ws); changed = true; }
      }
    }
    if (!changed) break;
  }
}

export function generateAllCombos(
  supply: number,
  layers: any[],
  weights: Record<string, Record<string, number>>,
  conflicts: any[]
): Record<string, any>[] {
  const seen = new Set<string>();
  let duplicateCount = 0;
  const combos = Array.from({ length: supply }, () => {
    let picks: Record<string, any> = {};
    let unique = false;
    for (let attempt = 0; attempt < 200; attempt++) {
      picks = {};
      for (const layer of layers) {
        const ws = weights[layer.folder] ?? {};
        const pick = pickWeighted(layer.assets, ws);
        if (pick) picks[layer.folder] = pick;
      }
      resolveConflicts(picks, conflicts, weights, layers);
      const key = layers.map(l => picks[l.folder]?.stem ?? '').join('|');
      if (!seen.has(key)) { seen.add(key); unique = true; break; }
    }
    if (!unique) duplicateCount++;
    return picks;
  });
  if (duplicateCount > 0) {
    console.warn(`[NFT Generator] ${duplicateCount} duplicate combo(s) could not be made unique after 200 attempts. Supply may exceed the number of possible unique combinations.`);
  }
  return combos;
}

export function applyNameFormat(fmt: string, idx: number): string {
  if (!fmt) return `#${idx}`;
  if (fmt.includes('{{id}}')) return fmt.replace(/\{\{id\}\}/g, String(idx));
  if (fmt.includes('{id}')) return fmt.replace(/\{id\}/g, String(idx));
  if (/\d/.test(fmt)) return fmt.replace(/(\d+)(?=[^0-9]*$)/, m => String(idx).padStart(m.length, '0'));
  return `${fmt} #${idx}`;
}

export type RarityTier = 'Legendary' | 'Epic' | 'Rare' | 'Common';

export function computeRarity(
  allCombos: Record<string, any>[],
  layers: any[]
): { index: number; score: number; rank: number; tier: RarityTier; attrs: { trait_type: string; value: string }[] }[] {
  const supply = allCombos.length;
  const traitCounts: Record<string, number> = {};
  for (const combo of allCombos) {
    for (const layer of layers) {
      const pick = combo[layer.folder];
      if (!pick || pick.rel === null) continue;
      const key = `${layer.label}\x00${pick.name}`;
      traitCounts[key] = (traitCounts[key] ?? 0) + 1;
    }
  }

  const scored = allCombos.map((combo, i) => {
    let score = 0;
    const attrs: { trait_type: string; value: string }[] = [];
    for (const layer of layers) {
      const pick = combo[layer.folder];
      if (!pick || pick.rel === null) continue;
      const key = `${layer.label}\x00${pick.name}`;
      // OpenSea statistical rarity: sum of (1 / trait_frequency) per trait
      score += supply / (traitCounts[key] ?? 1);
      attrs.push({ trait_type: layer.label, value: pick.name });
    }
    return { index: i + 1, score: Math.round(score * 100) / 100, attrs, rank: 0, tier: 'Common' as RarityTier };
  });
  // Sort by score DESC; use token index ASC as tiebreaker so every NFT gets a unique rank
  scored.sort((a, b) => b.score - a.score || a.index - b.index);

  // Sequential unique ranks — no ties
  scored.forEach((item, i) => { item.rank = i + 1; });

  // Named tiers by rank percentile (same thresholds as OpenSea: 1% / 5% / 15%)
  for (const item of scored) {
    if (item.rank <= Math.ceil(supply * 0.01)) item.tier = 'Legendary';
    else if (item.rank <= Math.ceil(supply * 0.05)) item.tier = 'Epic';
    else if (item.rank <= Math.ceil(supply * 0.15)) item.tier = 'Rare';
    else item.tier = 'Common';
  }

  return scored;
}
