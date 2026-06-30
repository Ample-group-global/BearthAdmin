// @ts-nocheck
'use client';
import { useState, useRef, Fragment } from 'react';

export default function Sidebar({ layers, activeFolder, onSelect, onLayersChange, onReorder, onGearClick, onToggleOptional }) {
  const [newName, setNewName]   = useState('');
  const [adding,  setAdding]    = useState(false);
  const [dragSrc, setDragSrc]   = useState(null);
  const [dragOver, setDragOver] = useState(null);

  async function createLayer() {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    await fetch('/api/layers/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setNewName('');
    setAdding(false);
    onLayersChange?.();
  }

  function handleDragStart(e, idx) {
    setDragSrc(idx);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e, idx) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (idx !== dragSrc) setDragOver(idx);
  }

  function handleDragLeave() { setDragOver(null); }

  function handleDrop(e, idx) {
    e.preventDefault();
    setDragOver(null);
    if (dragSrc === null || dragSrc === idx) return;
    const newOrder = layers.map(l => l.folder);
    const [moved] = newOrder.splice(dragSrc, 1);
    newOrder.splice(idx, 0, moved);
    onReorder?.(newOrder);
  }

  function handleDragEnd() { setDragSrc(null); setDragOver(null); }

  return (
    <aside className="sidebar">
      <div className="sb-new-layer">
        <input
          className="new-layer-input"
          placeholder="New layer name"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && createLayer()}
        />
        <button
          className="new-layer-add"
          onClick={createLayer}
          disabled={adding || !newName.trim()}
        >+ Add</button>
      </div>

      {layers.map((layer, idx) => (
        <Fragment key={layer.folder}>
          <div
            draggable={true}
            className={[
              'layer-item',
              activeFolder === layer.folder ? 'active' : '',
              dragOver === idx ? 'drag-over-target' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => onSelect(layer.folder)}
            onDragStart={e => handleDragStart(e, idx)}
            onDragOver={e => handleDragOver(e, idx)}
            onDragLeave={handleDragLeave}
            onDrop={e => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
          >
            <span className="layer-drag-handle" onMouseDown={e => e.stopPropagation()}>⠿</span>
            <div className="layer-item-main">
              <span className="ln">{layer.folder}</span>
              <span className="layer-meta">{layer.count} Files</span>
            </div>
            <button
              className={`layer-optional-btn${layer.optional ? ' layer-optional-active' : ''}`}
              title={layer.optional ? 'Optional layer — click to make required' : 'Make optional (may be skipped)'}
              onClick={e => { e.stopPropagation(); onToggleOptional?.(layer.folder, !layer.optional); }}
            >
              {layer.optional ? '∅' : '○'}
            </button>
            <button
              className="layer-gear"
              title="Layer settings"
              onClick={e => { e.stopPropagation(); onGearClick?.(layer.folder); }}
            >⚙</button>
          </div>
          {idx < layers.length - 1 && (
            <div className="layer-connector">
              <div className="lc-line" />
              <div className="lc-dot" />
              <div className="lc-line" />
            </div>
          )}
        </Fragment>
      ))}
    </aside>
  );
}
