import { getTier } from './tiers';

export function calcRarity(weight: number, totalWeight: number, supply: number) {
  const prob = totalWeight > 0 ? weight / totalWeight : 0;
  return {
    prob,
    pct:      (prob * 100).toFixed(1),
    tier:     getTier(prob),
    expected: Math.round(prob * supply),
  };
}
