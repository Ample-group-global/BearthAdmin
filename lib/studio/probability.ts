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

// Given the combined weight of every OTHER asset in a layer and a target
// probability (0-1), returns the 0-100 slider position at which this
// asset's own weight would produce that probability. Inverse of
// prob = w / (w + otherWeight) solved for w, then clamped to the slider range.
export function positionForProb(otherWeight: number, prob: number): number {
  if (prob <= 0 || otherWeight === 0) return 0;
  if (prob >= 1) return 100;
  return Math.min(100, (prob * otherWeight) / (1 - prob));
}
