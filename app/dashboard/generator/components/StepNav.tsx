// @ts-nocheck
'use client';

const STEPS = [
  { id: 'rarity',   label: 'Rarity',   icon: '💎' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'organize', label: 'Organize', icon: '🗂️' },
  { id: 'preview',  label: 'Preview',  icon: '👁️' },
  { id: 'export',   label: 'Export',   icon: '📦' },
];

export default function StepNav({ step, onStep }) {
  return (
    <nav className="step-nav">
      {STEPS.map(s => (
        <button
          key={s.id}
          className={`step-btn${step === s.id ? ' step-active' : ''}`}
          onClick={() => onStep(s.id)}
        >
          <span className="step-icon">{s.icon}</span>
          <span>{s.label}</span>
        </button>
      ))}
    </nav>
  );
}
