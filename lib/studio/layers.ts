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
  try { fs.writeFileSync(LAYERS_CFG, JSON.stringify({ folder }), 'utf8'); } catch {}
  clearLayersCache();
}

export function getLayersDir(): string {
  return path.resolve(process.cwd(), '..', getActiveFolder());
}

// Derive a readable display name from any filesystem stem.
// rel is the full relative path from the layers root (e.g. "10-hand/10-6-panda/10-6-7.png").
// When the file lives inside a descriptive subdirectory, we extract the human name from it.
export function getName(folder: string, stem: string, rel?: string | null): string {
  // Extract descriptive name from parent subdirectory for nested files.
  // e.g. rel="10-hand/10-6-panda/10-6-7.png" → parentDir="10-6-panda" → strip "10-6-" → "Panda"
  if (rel) {
    const parts = rel.split('/');
    if (parts.length >= 3) {
      const parentDir = parts[parts.length - 2];
      // Strip leading digits-dash-digits-dash prefix (e.g. "10-6-" from "10-6-panda")
      const descriptive = parentDir.replace(/^\d+[-_]\d+[-_]/, '').trim();
      if (descriptive && /[a-zA-Z]/.test(descriptive)) {
        return descriptive.replace(/[-_]+/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase()).trim();
      }
      // Also try stripping a single leading number prefix (e.g. "8-Andy" → "Andy")
      const singlePrefix = parentDir.replace(/^\d+[-_]/, '').trim();
      if (singlePrefix && /[a-zA-Z]/.test(singlePrefix)) {
        return singlePrefix.replace(/[-_]+/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase()).trim();
      }
    }
  }

  // For flat numeric stems (e.g. "0-1", "2-5", "6-1-0"), produce "LayerLabel N" format.
  // Strip the folder number prefix from the stem, then take the first segment.
  const folderNum = folder.match(/^(\d+)/)?.[1] ?? '';
  const inner = folderNum ? stem.replace(new RegExp(`^${folderNum}[-_]`), '') : stem;
  const firstSeg = inner.split(/[-_]/)[0];
  if (firstSeg && /^\d+$/.test(firstSeg)) {
    return `${deriveLabelFromFolder(folder)} ${firstSeg}`;
  }

  // Fallback: humanise whatever remains
  return inner.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim() || stem;
}

function sortKey(name: string): number {
  const n = parseInt(name);
  return isNaN(n) ? 999 : n;
}

function isAscii(s: string): boolean {
  try { return Buffer.from(s, 'ascii').toString('ascii') === s; }
  catch { return false; }
}

const natSort = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

function collectPngs(dir: string, layerDir: string) {
  const results: { stem: string; rel: string | null }[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => natSort(a.name, b.name)); // natural sort: file2 before file10
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
      name:          traitNames[fname]?.[stem] ?? getName(fname, stem, rel),
      rel,
      defaultWeight: DEFAULT_WEIGHTS[fname]?.[stem] ?? 1,
    }));

    // When multiple files in the same layer derive the same display name
    // (e.g. three PNGs inside "3-luna/" all become "Luna"), append a number
    // so each appears as a distinct selectable trait: Luna 1 / Luna 2 / Luna 3.
    const nameCounts: Record<string, number> = {};
    for (const a of assets) nameCounts[a.name] = (nameCounts[a.name] ?? 0) + 1;
    const nameIdx: Record<string, number> = {};
    for (const a of assets) {
      if (nameCounts[a.name] > 1) {
        nameIdx[a.name] = (nameIdx[a.name] ?? 0) + 1;
        a.name = `${a.name} ${nameIdx[a.name]}`;
      }
    }

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
