import fs   from 'fs';
import path from 'path';
import { DEFAULT_WEIGHTS } from './default-weights';

export const LAYERS_DIR = path.resolve(
  process.cwd(),
  '..',
  'Bearth-NFT-Generator',
  'exported_layers'
);

// Derive a readable display name from any filesystem stem.
// "red-hoodie" → "Red Hoodie", "bear_character" → "Bear Character"
// For stems that encode the full folder path (e.g. "exported_layers_2_body_onemint_2_body_2_1"),
// strips everything up to the last occurrence of the layer label word and returns the remainder.
export function getName(folder: string, stem: string): string {
  const raw = stem.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim() || stem;

  if (raw.split(' ').length > 5) {
    // e.g. folder "2-body" → label last word "Body"; folder "5-back-front" → "Front"
    const labelLastWord = folder
      .replace(/^\d+[-_]/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim()
      .split(' ')
      .pop() ?? '';

    if (labelLastWord) {
      const idx = raw.lastIndexOf(labelLastWord);
      if (idx !== -1) {
        const after = raw.slice(idx + labelLastWord.length).trim();
        if (after) return after;
      }
    }
  }

  return raw;
}

function sortKey(name: string): number {
  const n = parseInt(name);
  return isNaN(n) ? 999 : n;
}

function isAscii(s: string): boolean {
  try { return Buffer.from(s, 'ascii').toString('ascii') === s; }
  catch { return false; }
}

function collectPngs(dir: string, layerDir: string) {
  const results: { stem: string; rel: string | null }[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      results.push(...collectPngs(full, layerDir));
    } else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (ext === '.png') {
        const stem = path.basename(e.name, '.png');
        if (!isAscii(stem)) continue;
        results.push({ stem, rel: path.relative(layerDir, full).replace(/\\/g, '/') });
      } else if (ext === '') {
        // No-extension file = NONE placeholder uploaded by artist
        const stem = e.name;
        if (!isAscii(stem)) continue;
        results.push({ stem, rel: null });
      }
    }
  }
  return results;
}

function deriveLabelFromFolder(fname: string): string {
  return fname.replace(/^\d+[-_]/, '').replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase()).trim() || fname;
}

// Generates a virtual NONE stem that won't collide with real files.
// Follows the convention "{prefix}-0" (e.g. folder "4-clothes" → "4-0").
function virtualNoneStem(folderName: string): string {
  const m = folderName.match(/^(\d+)/);
  return m ? `${m[1]}-0` : 'none';
}

// ── Layer order ──────────────────────────────────────────────────────────────

const LAYER_ORDER_FILE = path.join(LAYERS_DIR, '.layer-order.json');

export function getLayerOrder() {
  try {
    if (fs.existsSync(LAYER_ORDER_FILE)) {
      return JSON.parse(fs.readFileSync(LAYER_ORDER_FILE, 'utf8'));
    }
  } catch { }
  return null;
}

export function saveLayerOrder(folders: string[]) {
  if (!fs.existsSync(LAYERS_DIR)) return;
  fs.writeFileSync(LAYER_ORDER_FILE, JSON.stringify(folders), 'utf8');
  clearLayersCache();
}

// ── Layer config (optional layers) ──────────────────────────────────────────
// Replaces hardcoded VIRTUAL_NONES — artist marks layers as optional via the UI.

const LAYER_CONFIG_FILE = path.join(LAYERS_DIR, '.layer-config.json');

export function getLayerConfig(): { optional: string[] } {
  try {
    if (fs.existsSync(LAYER_CONFIG_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(LAYER_CONFIG_FILE, 'utf8'));
      return { optional: Array.isArray(parsed.optional) ? parsed.optional : [] };
    }
  } catch { }
  return { optional: [] };
}

export function saveLayerConfig(config: { optional: string[] }) {
  if (!fs.existsSync(LAYERS_DIR)) return;
  fs.writeFileSync(LAYER_CONFIG_FILE, JSON.stringify(config), 'utf8');
  clearLayersCache();
}

// ── Trait display names ──────────────────────────────────────────────────────

const TRAIT_NAMES_FILE = path.join(LAYERS_DIR, '.trait-names.json');

export function getTraitNames(): Record<string, Record<string, string>> {
  try {
    if (fs.existsSync(TRAIT_NAMES_FILE)) {
      return JSON.parse(fs.readFileSync(TRAIT_NAMES_FILE, 'utf8'));
    }
  } catch { }
  return {};
}

export function saveTraitName(folder: string, stem: string, name: string | null) {
  const all = getTraitNames();
  if (!all[folder]) all[folder] = {};
  if (name) {
    all[folder][stem] = name;
  } else {
    delete all[folder][stem];
    if (!Object.keys(all[folder]).length) delete all[folder];
  }
  if (!fs.existsSync(LAYERS_DIR)) return;
  fs.writeFileSync(TRAIT_NAMES_FILE, JSON.stringify(all), 'utf8');
  clearLayersCache();
}

// ── Conflict / force rules ───────────────────────────────────────────────────

const CONFLICTS_FILE = path.join(LAYERS_DIR, '.conflicts.json');

export function getConflicts() {
  try {
    if (fs.existsSync(CONFLICTS_FILE)) {
      return JSON.parse(fs.readFileSync(CONFLICTS_FILE, 'utf8'));
    }
  } catch { }
  return [];
}

export function saveConflicts(rules: unknown[]) {
  if (!fs.existsSync(LAYERS_DIR)) return;
  fs.writeFileSync(CONFLICTS_FILE, JSON.stringify(rules), 'utf8');
}

// ── Layer scan ───────────────────────────────────────────────────────────────

let _cache: ReturnType<typeof buildCache> | null = null;

function buildCache() {
  const diskFolders = fs.readdirSync(LAYERS_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);

  const savedOrder = getLayerOrder();
  let orderedNames: string[];
  if (savedOrder && Array.isArray(savedOrder)) {
    const savedSet = new Set<string>(savedOrder);
    const extras = diskFolders.filter(n => !savedSet.has(n)).sort((a, b) => sortKey(a) - sortKey(b));
    orderedNames = [...savedOrder.filter((n: string) => diskFolders.includes(n)), ...extras];
  } else {
    orderedNames = diskFolders.slice().sort((a, b) => sortKey(a) - sortKey(b));
  }

  const { optional = [] } = getLayerConfig();
  const optionalSet = new Set(optional);
  const traitNames  = getTraitNames();

  return orderedNames.flatMap(fname => {
    const fpath     = path.join(LAYERS_DIR, fname);
    const rawAssets = collectPngs(fpath, LAYERS_DIR);

    // If artist marked this layer optional and no on-disk NONE placeholder exists, inject one
    if (optionalSet.has(fname) && !rawAssets.some(a => a.rel === null)) {
      rawAssets.unshift({ stem: virtualNoneStem(fname), rel: null });
    }

    const assets = rawAssets.map(({ stem, rel }) => ({
      stem,
      name:          traitNames[fname]?.[stem] ?? getName(fname, stem),
      rel,
      defaultWeight: DEFAULT_WEIGHTS[fname]?.[stem] ?? 1,
    }));

    if (!assets.length) return [];
    return [{
      folder:   fname,
      label:    deriveLabelFromFolder(fname),
      count:    assets.length,
      optional: optionalSet.has(fname),
      assets,
    }];
  });
}

export function clearLayersCache() { _cache = null; }

export function scanLayers() {
  if (_cache) return _cache;
  if (!fs.existsSync(LAYERS_DIR)) return [];
  _cache = buildCache();
  return _cache;
}
