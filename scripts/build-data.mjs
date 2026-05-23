// Build src/data/cangjie5.json from rime-cangjie yaml dictionaries.
// Source: https://github.com/rime/rime-cangjie (GPL)
//
// Usage:
//   node scripts/build-data.mjs              # fetch from GitHub then build
//   node scripts/build-data.mjs --offline    # use cached scripts/raw/*.yaml

import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const RAW_DIR = join(__dirname, 'raw');
const OUT_FILE = join(ROOT, 'src', 'data', 'cangjie5.json');

// cangjie5.dict.yaml is just a schema that imports the three tables below.
// We pull the entry tables directly. Base is preferred over extended for common chars.
const SOURCES = [
  {
    name: 'cangjie5.base.dict.yaml',
    url: 'https://raw.githubusercontent.com/rime/rime-cangjie/master/cangjie5.base.dict.yaml',
  },
  {
    name: 'cangjie5.extended.dict.yaml',
    url: 'https://raw.githubusercontent.com/rime/rime-cangjie/master/cangjie5.extended.dict.yaml',
  },
];

const HAN_RE = /^\p{Script=Han}$/u;
// Codes are lowercase a-y. The schema excludes x* and z* (collision/special),
// but x is a legitimate radical key (難) too — we keep x*, drop z*.
const CODE_RE = /^[a-y]+$/;
const EXCLUDE_PREFIX = /^z/;

async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

async function fileExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function getSource(src, offline) {
  const cached = join(RAW_DIR, src.name);
  if (offline || (await fileExists(cached))) {
    if (!(await fileExists(cached))) {
      throw new Error(`offline mode but missing ${cached}`);
    }
    return await readFile(cached, 'utf8');
  }
  console.log(`fetching ${src.url}`);
  const res = await fetch(src.url);
  if (!res.ok) throw new Error(`fetch ${src.url} failed: ${res.status}`);
  const text = await res.text();
  await ensureDir(RAW_DIR);
  await writeFile(cached, text);
  return text;
}

// Parse a rime yaml dict. Returns array of {text, code, weight}.
// Entries start after the "..." document-end marker.
function parseDict(yaml) {
  const lines = yaml.split(/\r?\n/);
  let bodyStart = lines.findIndex((l) => l.trim() === '...');
  if (bodyStart === -1) bodyStart = 0;
  else bodyStart += 1;

  const entries = [];
  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith('#')) continue;
    const parts = line.split('\t');
    if (parts.length < 2) continue;
    const text = parts[0];
    const code = parts[1];
    const weight = parts[2] ? parseInt(parts[2], 10) : 0;
    if (!text || !code) continue;
    entries.push({ text, code, weight: Number.isFinite(weight) ? weight : 0 });
  }
  return entries;
}

function isSingleHan(text) {
  // [...text] handles surrogate pairs (e.g. CJK extension B chars like 𠮷)
  const chars = [...text];
  return chars.length === 1 && HAN_RE.test(chars[0]);
}

async function main() {
  const offline = process.argv.includes('--offline');

  const merged = new Map(); // char -> {code, weight, source}

  for (const src of SOURCES) {
    const yaml = await getSource(src, offline);
    const entries = parseDict(yaml);
    let kept = 0;
    for (const e of entries) {
      if (!isSingleHan(e.text)) continue;
      if (!CODE_RE.test(e.code)) continue;
      if (EXCLUDE_PREFIX.test(e.code)) continue;
      const prev = merged.get(e.text);
      // base file is processed first; prefer base over extended; within file, prefer higher weight
      if (!prev) {
        merged.set(e.text, { code: e.code, weight: e.weight, source: src.name });
        kept++;
      } else if (prev.source === src.name && e.weight > prev.weight) {
        merged.set(e.text, { code: e.code, weight: e.weight, source: src.name });
      }
      // else: keep prev (base wins over extended)
    }
    console.log(`  ${src.name}: parsed ${entries.length} lines, kept ${kept} new single-han entries`);
  }

  // Output { char: code } sorted by char codepoint for stable diffs.
  const sortedChars = [...merged.keys()].sort();
  const out = {};
  for (const c of sortedChars) out[c] = merged.get(c).code;

  await ensureDir(dirname(OUT_FILE));
  const json = JSON.stringify(out);
  await writeFile(OUT_FILE, json);

  const sizeKB = (json.length / 1024).toFixed(1);
  console.log(`\nwrote ${OUT_FILE}`);
  console.log(`  ${sortedChars.length} unique characters, ${sizeKB} KB`);

  // Spot-check common characters
  const spotCheck = ['好', '友', '日', '月', '火', '愛', '鬱', '葉', '智', '豪'];
  console.log('\nspot check:');
  for (const c of spotCheck) {
    const code = out[c];
    console.log(`  ${c} -> ${code ? code.toUpperCase() : '(missing)'}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
