#!/usr/bin/env node
/**
 * NFT Collection Deep Audit
 * Checks: ERC-721 / OpenSea metadata standard, uniqueness, rarity distribution,
 *         file completeness, trait name quality, image validity (PNG header).
 *
 * Usage:  node tests/nft-audit.mjs [path-to-zip]
 *         If no path given, scans test-results/ for the latest *.zip
 */

import fs   from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath }  from 'url';

const require   = createRequire(import.meta.url);
const JSZip     = require('jszip');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── locate ZIP ───────────────────────────────────────────────────────────────
function findLatestZip() {
  const dir = path.join(__dirname, '..', 'test-results');
  if (!fs.existsSync(dir)) return null;
  const zips = fs.readdirSync(dir)
    .filter(f => f.endsWith('.zip'))
    .map(f => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  return zips.length ? path.join(dir, zips[0].f) : null;
}

const zipPath = process.argv[2] || findLatestZip();
if (!zipPath || !fs.existsSync(zipPath)) {
  console.error('No ZIP found. Run the Playwright test first, or pass the path as argument.');
  process.exit(1);
}
console.log(`\nAuditing: ${zipPath}\n`);

// ── load ZIP ─────────────────────────────────────────────────────────────────
const zipData = fs.readFileSync(zipPath);
const zip     = await JSZip.loadAsync(zipData);

// ── collect files ────────────────────────────────────────────────────────────
const metaFiles  = [];
const imageFiles = [];

zip.forEach((relPath, file) => {
  if (file.dir) return;
  if (relPath.match(/metadata\/\d+\.json$/))  metaFiles.push({ relPath, file });
  if (relPath.match(/images\/\d+\.(png|webp)$/i)) imageFiles.push({ relPath, file });
});

metaFiles.sort((a, b) => {
  const na = parseInt(a.relPath.match(/(\d+)\.json/)?.[1] ?? '0');
  const nb = parseInt(b.relPath.match(/(\d+)\.json/)?.[1] ?? '0');
  return na - nb;
});
imageFiles.sort((a, b) => {
  const na = parseInt(a.relPath.match(/(\d+)\./)?.[1] ?? '0');
  const nb = parseInt(b.relPath.match(/(\d+)\./)?.[1] ?? '0');
  return na - nb;
});

const supply = metaFiles.length;
console.log(`═══════════ FILE COUNT ═══════════`);
console.log(`  Metadata JSON : ${metaFiles.length}`);
console.log(`  Image files   : ${imageFiles.length}`);
if (metaFiles.length !== imageFiles.length) {
  console.log(`  ❌ MISMATCH – metadata count ≠ image count`);
} else {
  console.log(`  ✓ Counts match`);
}

// ── 1. SEQUENTIAL EDITION NUMBERS ────────────────────────────────────────────
console.log(`\n═══════════ EDITION NUMBERING ════`);
const missingEditions = [];
for (let i = 1; i <= supply; i++) {
  const found = metaFiles.some(m => m.relPath.includes(`/${i}.json`) || m.relPath.endsWith(`${i}.json`));
  if (!found) missingEditions.push(i);
}
if (missingEditions.length === 0) {
  console.log(`  ✓ All editions 1–${supply} present`);
} else {
  console.log(`  ❌ Missing edition numbers: ${missingEditions.slice(0, 20).join(', ')}${missingEditions.length > 20 ? '…' : ''}`);
}

// ── 2. ERC-721 / OpenSea METADATA STANDARD ───────────────────────────────────
console.log(`\n═══════════ ERC-721 METADATA ═════`);
const REQUIRED_FIELDS = ['name', 'image', 'attributes'];
const fieldErrors = [];
const allMeta = [];

let parsed = 0;
const SAMPLE = Math.min(supply, 200); // audit first+last 100 + random sample

const toCheck = new Set([
  ...metaFiles.slice(0, 100).map((_, i) => i),
  ...metaFiles.slice(-100).map((_, i) => supply - 100 + i),
  ...Array.from({ length: 100 }, () => Math.floor(Math.random() * supply)),
].filter(i => i >= 0 && i < supply));

for (const idx of toCheck) {
  const { relPath, file } = metaFiles[idx];
  const raw = await file.async('string');
  let meta;
  try { meta = JSON.parse(raw); } catch {
    fieldErrors.push(`  ❌ ${relPath}: invalid JSON`); continue;
  }
  allMeta.push({ idx, meta });
  parsed++;
  for (const field of REQUIRED_FIELDS) {
    if (!meta[field] && meta[field] !== 0) {
      fieldErrors.push(`  ❌ ${relPath}: missing required field "${field}"`);
    }
  }
}

// Load ALL metadata for uniqueness/rarity checks
const allMetaFull = [];
for (const { relPath, file } of metaFiles) {
  const raw = await file.async('string');
  try { allMetaFull.push(JSON.parse(raw)); } catch {}
}

if (fieldErrors.length === 0) {
  console.log(`  ✓ All ${SAMPLE}-sample metadata files have required ERC-721 fields`);
  console.log(`    (name, image, attributes)`);
} else {
  fieldErrors.slice(0, 10).forEach(e => console.log(e));
  if (fieldErrors.length > 10) console.log(`  … and ${fieldErrors.length - 10} more errors`);
}

// Check image URI format
const imageUriErrors = [];
for (const { meta } of allMeta) {
  if (typeof meta.image !== 'string') { imageUriErrors.push('non-string image'); continue; }
  if (!meta.image.startsWith('ipfs://') && !meta.image.startsWith('http')) {
    imageUriErrors.push(meta.image.slice(0, 60));
  }
}
if (imageUriErrors.length === 0) {
  console.log(`  ✓ Image URIs are valid (ipfs:// scheme)`);
} else {
  console.log(`  ⚠ Image URI issues (first 3): ${imageUriErrors.slice(0,3).join(' | ')}`);
}

// Check description field
const hasDescription = allMeta.filter(({ meta }) => meta.description && meta.description.trim()).length;
console.log(`  ${hasDescription === allMeta.length ? '✓' : '⚠'} description field: present in ${hasDescription}/${allMeta.length} sampled`);

// ── 3. ATTRIBUTES FORMAT ─────────────────────────────────────────────────────
console.log(`\n═══════════ ATTRIBUTES FORMAT ════`);
const digitNamePattern = /^\d[\d\s]*$/;
const digitTraitIssues = [];
const emptyAttrIssues  = [];
let totalAttrs = 0;
let traitTypeSet = new Set();

for (const { meta } of allMeta) {
  if (!Array.isArray(meta.attributes)) continue;
  if (meta.attributes.length === 0) emptyAttrIssues.push('empty attributes array');
  for (const attr of meta.attributes) {
    totalAttrs++;
    if (typeof attr.trait_type === 'string') traitTypeSet.add(attr.trait_type);
    if (digitNamePattern.test(String(attr.value ?? ''))) {
      digitTraitIssues.push(`"${attr.value}" (trait: ${attr.trait_type})`);
    }
    if (!attr.trait_type) emptyAttrIssues.push('missing trait_type');
    if (attr.value === undefined || attr.value === null || attr.value === '') {
      emptyAttrIssues.push(`empty value for trait_type="${attr.trait_type}"`);
    }
  }
}

const avgAttrs = allMeta.length ? (totalAttrs / allMeta.length).toFixed(1) : 0;
console.log(`  Avg attributes per NFT: ${avgAttrs}`);
console.log(`  Unique trait_type names: ${[...traitTypeSet].join(', ')}`);

if (digitTraitIssues.length === 0) {
  console.log(`  ✓ All trait values are human-readable text (no digit codes)`);
} else {
  console.log(`  ❌ ${digitTraitIssues.length} digit-code values found (first 5):`);
  digitTraitIssues.slice(0, 5).forEach(v => console.log(`     ${v}`));
}

if (emptyAttrIssues.length === 0) {
  console.log(`  ✓ No empty trait_type or value fields`);
} else {
  console.log(`  ⚠ ${emptyAttrIssues.length} empty attribute issues (first 3): ${emptyAttrIssues.slice(0,3).join(', ')}`);
}

// ── 4. UNIQUENESS CHECK ───────────────────────────────────────────────────────
console.log(`\n═══════════ UNIQUENESS CHECK ═════`);
const comboKeys = new Set();
let duplicates = 0;
const dupExamples = [];

for (let i = 0; i < allMetaFull.length; i++) {
  const meta = allMetaFull[i];
  if (!Array.isArray(meta.attributes)) continue;
  const key = meta.attributes.map(a => `${a.trait_type}:${a.value}`).sort().join('|');
  if (comboKeys.has(key)) {
    duplicates++;
    if (dupExamples.length < 3) dupExamples.push(`NFT #${i + 1}`);
  } else {
    comboKeys.add(key);
  }
}

if (duplicates === 0) {
  console.log(`  ✓ All ${supply} NFTs are unique (no duplicate trait combinations)`);
} else {
  console.log(`  ❌ ${duplicates} duplicate combinations found`);
  dupExamples.forEach(ex => console.log(`     ${ex}`));
}

// ── 5. RARITY DISTRIBUTION ───────────────────────────────────────────────────
console.log(`\n═══════════ RARITY DISTRIBUTION ══`);
const traitFreq = {};

for (const meta of allMetaFull) {
  if (!Array.isArray(meta.attributes)) continue;
  for (const attr of meta.attributes) {
    if (!traitFreq[attr.trait_type]) traitFreq[attr.trait_type] = {};
    const key = String(attr.value);
    traitFreq[attr.trait_type][key] = (traitFreq[attr.trait_type][key] ?? 0) + 1;
  }
}

let raritySummary = [];
for (const [traitType, vals] of Object.entries(traitFreq)) {
  const entries = Object.entries(vals).sort((a, b) => a[1] - b[1]);
  const rarest  = entries[0];
  const common  = entries[entries.length - 1];
  const rarestPct = ((rarest[1] / supply) * 100).toFixed(2);
  const commonPct = ((common[1] / supply) * 100).toFixed(2);
  raritySummary.push({ traitType, rarest: `${rarest[0]} (${rarestPct}%)`, common: `${common[0]} (${commonPct}%)`, variants: entries.length });
}

raritySummary.forEach(r => {
  console.log(`  ${r.traitType} [${r.variants} variants]:`);
  console.log(`    Rarest : ${r.rarest}`);
  console.log(`    Common : ${r.common}`);
});

// Check legendary tier (≤5% supply)
let legendaryCount = 0;
let epicCount = 0;
let rareCount = 0;
for (const [, vals] of Object.entries(traitFreq)) {
  for (const [, count] of Object.entries(vals)) {
    const pct = count / supply;
    if (pct <= 0.05) legendaryCount++;
    else if (pct <= 0.15) epicCount++;
    else if (pct <= 0.30) rareCount++;
  }
}
console.log(`\n  Trait-value tier breakdown:`);
console.log(`    🟡 Legendary (≤5%)  : ${legendaryCount} trait values`);
console.log(`    🟠 Epic     (≤15%)  : ${epicCount} trait values`);
console.log(`    🔵 Rare     (≤30%)  : ${rareCount} trait values`);

// ── 6. IMAGE FILE VALIDITY ───────────────────────────────────────────────────
console.log(`\n═══════════ IMAGE VALIDITY ════════`);
const PNG_HEADER  = Buffer.from([137,80,78,71,13,10,26,10]);
const WEBP_HEADER = Buffer.from('RIFF');

let validImages = 0;
let corruptImages = 0;
let totalImageBytes = 0;
const IMAGE_SAMPLE = Math.min(imageFiles.length, 50);

for (let i = 0; i < IMAGE_SAMPLE; i++) {
  const { relPath, file } = imageFiles[Math.floor(i * imageFiles.length / IMAGE_SAMPLE)];
  const data = Buffer.from(await file.async('arraybuffer'));
  totalImageBytes += data.length;
  const isPng  = data.length >= 8 && data.slice(0,8).equals(PNG_HEADER);
  const isWebp = data.length >= 4 && data.slice(0,4).equals(WEBP_HEADER);
  if (isPng || isWebp) { validImages++; }
  else { corruptImages++; console.log(`  ❌ corrupt: ${relPath} (first 4 bytes: ${data.slice(0,4).toString('hex')})`); }
}

const avgImageKb = IMAGE_SAMPLE ? ((totalImageBytes / IMAGE_SAMPLE) / 1024).toFixed(1) : 0;
console.log(`  Sampled ${IMAGE_SAMPLE} images: ${validImages} valid, ${corruptImages} corrupt`);
console.log(`  Avg image size: ${avgImageKb} KB`);
if (corruptImages === 0) console.log(`  ✓ All sampled images are valid PNG/WebP files`);

// ── 7. NFT NAME FORMAT ───────────────────────────────────────────────────────
console.log(`\n═══════════ NFT NAMING ════════════`);
const nameExamples = allMetaFull.slice(0, 5).map(m => m.name).filter(Boolean);
console.log(`  First 5 names: ${nameExamples.join(', ')}`);
const namePatternOk = allMeta.every(({ meta }) => typeof meta.name === 'string' && meta.name.includes('#'));
console.log(`  ${namePatternOk ? '✓' : '⚠'} Names follow "Collection #N" pattern`);

// ── SUMMARY ───────────────────────────────────────────────────────────────────
console.log(`\n╔═══════════ AUDIT SUMMARY ════════╗`);
console.log(`  Supply          : ${supply} NFTs`);
console.log(`  Unique combos   : ${comboKeys.size}`);
console.log(`  Duplicates      : ${duplicates === 0 ? '✓ NONE' : '❌ ' + duplicates}`);
console.log(`  ERC-721 fields  : ${fieldErrors.length === 0 ? '✓ PASS' : '❌ ' + fieldErrors.length + ' errors'}`);
console.log(`  Trait names     : ${digitTraitIssues.length === 0 ? '✓ PASS (text only)' : '❌ ' + digitTraitIssues.length + ' digit codes'}`);
console.log(`  Images valid    : ${corruptImages === 0 ? '✓ PASS' : '❌ ' + corruptImages + ' corrupt'}`);
console.log(`  Image:meta match: ${metaFiles.length === imageFiles.length ? '✓ PASS' : '❌ MISMATCH'}`);
console.log(`╚══════════════════════════════════╝\n`);
