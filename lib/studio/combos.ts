// Shared client-side combo generation logic used by PreviewPanel and ExportPanel

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
      type:       r.type ?? 'exclude',
      ifLayer:    r.ifLayer,
      ifTrait:    r.ifTrait,
      thenLayer:  r.thenLayer,
      thenTraits: Array.isArray(r.thenTraits) ? r.thenTraits : (r.thenTrait ? [r.thenTrait] : []),
    }))
    .filter(r => r.thenTraits.length);

  for (let pass = 0; pass < 5; pass++) {
    let changed = false;
    for (const rule of rules) {
      if (picks[rule.ifLayer]?.stem !== rule.ifTrait) continue;
      const thenLayer = layerMap[rule.thenLayer];
      if (!thenLayer) continue;
      const ws = weights[rule.thenLayer] ?? {};
      if (rule.type === 'exclude') {
        if (!rule.thenTraits.includes(picks[rule.thenLayer]?.stem)) continue;
        const valid = thenLayer.assets.filter(
          (a: any) => !rule.thenTraits.includes(a.stem) && (ws[a.stem] ?? a.defaultWeight ?? 1) > 0
        );
        if (valid.length) { picks[rule.thenLayer] = pickWeighted(valid, ws); changed = true; }
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
  return Array.from({ length: supply }, () => {
    let picks: Record<string, any> = {};
    for (let attempt = 0; attempt < 3; attempt++) {
      picks = {};
      for (const layer of layers) {
        const ws = weights[layer.folder] ?? {};
        const pick = pickWeighted(layer.assets, ws);
        if (pick) picks[layer.folder] = pick;
      }
      resolveConflicts(picks, conflicts, weights, layers);
      const key = layers.map(l => picks[l.folder]?.stem ?? '').join('|');
      if (!seen.has(key)) { seen.add(key); break; }
    }
    return picks;
  });
}

export function applyNameFormat(fmt: string, idx: number): string {
  if (!fmt) return `#${idx}`;
  if (fmt.includes('{{id}}')) return fmt.replace(/\{\{id\}\}/g, String(idx));
  if (fmt.includes('{id}'))   return fmt.replace(/\{id\}/g,   String(idx));
  if (/\d/.test(fmt)) return fmt.replace(/(\d+)(?=[^0-9]*$)/, m => String(idx).padStart(m.length, '0'));
  return `${fmt} #${idx}`;
}

export function computeRarity(
  allCombos: Record<string, any>[],
  layers: any[]
): { index: number; score: number; rank: number; attrs: { trait_type: string; value: string }[] }[] {
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
      score += supply / (traitCounts[key] ?? 1);
      attrs.push({ trait_type: layer.label, value: pick.name });
    }
    return { index: i + 1, score: Math.round(score * 10) / 10, attrs, rank: 0 };
  });

  scored.sort((a, b) => b.score - a.score);
  scored.forEach((item, i) => { item.rank = i + 1; });
  return scored;
}
