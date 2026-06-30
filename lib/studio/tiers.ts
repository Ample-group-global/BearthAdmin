export const TIERS = [
  { max: 0.01, label: 'Legendary', color: '#F59E0B', bg: 'rgba(245,158,11,.15)' },
  { max: 0.05, label: 'Epic',      color: '#A855F7', bg: 'rgba(168,85,247,.15)' },
  { max: 0.20, label: 'Rare',      color: '#3B82F6', bg: 'rgba(59,130,246,.15)'  },
  { max: 0.50, label: 'Uncommon',  color: '#22C55E', bg: 'rgba(34,197,94,.15)'   },
  { max: 1.00, label: 'Common',    color: '#6B7280', bg: 'rgba(107,114,128,.15)' },
];

export function getTier(prob: any) {
  return TIERS.find(t => prob <= t.max) ?? TIERS[TIERS.length - 1];
}
