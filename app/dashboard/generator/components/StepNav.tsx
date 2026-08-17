// @ts-nocheck
'use client';
import React from 'react';

// Rarity tab hidden for the time being — flip this back to true to restore it.
const SHOW_RARITY_TAB = false;

const ALL_STEPS = [
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'organize', label: 'Organize', icon: '🗂️' },
  { id: 'rarity',   label: 'Rarity',   icon: '💎' },
  { id: 'preview',  label: 'Preview',  icon: '👁️' },
  { id: 'export',   label: 'Export',   icon: '📦' },
];
const STEPS = SHOW_RARITY_TAB ? ALL_STEPS : ALL_STEPS.filter(s => s.id !== 'rarity');

export default function StepNav({ step, onStep }) {
  return (
    <nav className="step-nav">
      {STEPS.map((s, i) => (
        <React.Fragment key={s.id}>
          <button
            className={`step-btn${step === s.id ? ' step-active' : ''}`}
            onClick={() => onStep(s.id)}
          >
            <span className="step-icon">{s.icon}</span>
            <span>{s.label}</span>
          </button>
          {i < STEPS.length - 1 && (
            <span className="step-sep">›</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
