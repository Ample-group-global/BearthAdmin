import fs   from 'fs';
import path from 'path';
import { DEFAULT_WEIGHTS } from './default-weights';

// ── Active layers folder (dynamic) ──────────────────────────────────────────
// Stored in BearthAdmin/.layers-config.json so it persists across restarts.
// Default falls back to 'BearthLayersv1' for backward compatibility.

const LAYERS_CFG = path.join(process.cwd(), '.layers-config.json');

export function getActiveFolder(): string {
  try {
    if (fs.existsSync(LAYERS_CFG)) {
      const { folder } = JSON.parse(fs.readFileSync(LAYERS_CFG, 'utf8'));
      if (folder && typeof folder === 'string') return folder;
    }
  } catch {}
  return 'BearthLayersv1';
}

export function setActiveFolder(folder: string) {
  fs.writeFileSync(LAYERS_CFG, JSON.stringify({ folder }), 'utf8');
  clearLayersCache();
}

export function getLayersDir(): string {
  return path.resolve(process.cwd(), '..', getActiveFolder());
}

// Derive a readable display name from any filesystem stem.
export function getName(folder: string, stem: string): string {
  const raw = stem.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim() || stem;

  if (raw.split(' ').length > 5) {
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

function virtualNoneStem(folderName: string): string {
  const m = folderName.match(/^(\d+)/);
  return m ? `${m[1]}-0` : 'none';
}

// ── Layer order ──────────────────────────────────────────────────────────────

export function getLayerOrder() {
  const file = path.join(getLayersDir(), '.layer-order.json');
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {}
  return null;
}

export function saveLayerOrder(folders: string[]) {
  const dir = getLayersDir();
  if (!fs.existsSync(dir)) return;
  fs.writeFileSync(path.join(dir, '.layer-order.json'), JSON.stringify(folders), 'utf8');
  clearLayersCache();
}

// ── Layer config (optional layers) ──────────────────────────────────────────

export function getLayerConfig(): { optional: string[] } {
  const file = path.join(getLayersDir(), '.layer-config.json');
  try {
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      return { optional: Array.isArray(parsed.optional) ? parsed.optional : [] };
    }
  } catch {}
  return { optional: [] };
}

export function saveLayerConfig(config: { optional: string[] }) {
  const dir = getLayersDir();
  if (!fs.existsSync(dir)) return;
  fs.writeFileSync(path.join(dir, '.layer-config.json'), JSON.stringify(config), 'utf8');
  clearLayersCache();
}

// ── Trait display names ──────────────────────────────────────────────────────

export function getTraitNames(): Record<string, Record<string, string>> {
  const file = path.join(getLayersDir(), '.trait-names.json');
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {}
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
  const dir = getLayersDir();
  if (!fs.existsSync(dir)) return;
  fs.writeFileSync(path.join(dir, '.trait-names.json'), JSON.stringify(all), 'utf8');
  clearLayersCache();
}

// ── Conflict / force rules ───────────────────────────────────────────────────

export function getConflicts() {
  const file = path.join(getLayersDir(), '.conflicts.json');
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {}
  return [];
}

export function saveConflicts(rules: unknown[]) {
  const dir = getLayersDir();
  if (!fs.existsSync(dir)) return;
  fs.writeFileSync(path.join(dir, '.conflicts.json'), JSON.stringify(rules), 'utf8');
}

// ── Layer scan ───────────────────────────────────────────────────────────────

let _cache: ReturnType<typeof buildCache> | null = null;

function buildCache() {
  const layersDir = getLayersDir();
  const diskFolders = fs.readdirSync(layersDir, { withFileTypes: true })
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
    const fpath     = path.join(layersDir, fname);
    const rawAssets = collectPngs(fpath, layersDir);

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
  const layersDir = getLayersDir();
  if (!fs.existsSync(layersDir)) return [];
  _cache = buildCache();
  return _cache;
}
