#!/usr/bin/env node
/**
 * loc-badge - generate shields.io endpoint badges for lines of code per workspace.
 *
 * For each workspace it counts the lines in git-tracked source files (code only:
 * .ts, .tsx, .js, .jsx, .mjs, .cjs, .vue, .json), then writes one shields.io
 * "endpoint" JSON per workspace plus a repo-wide total into .github/badges/.
 *
 * Each README references its badge via:
 *   https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/<repo>/main/.github/badges/loc-<key>.json
 *
 * Regenerated on push to main by .github/workflows/loc-badges.yml, and runnable
 * locally with:  node scripts/loc-badge.mjs
 *
 * Exit code 1 if any badge file changed (so CI can detect drift in --check mode).
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BADGES_DIR = join(ROOT, '.github', 'badges');
const COLOR = '007ec6';
const LABEL = 'lines of code';

const CODE_EXT = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'vue', 'json',
]);

/** key -> directory, in display order. Add a workspace here to badge it. */
const WORKSPACES = [
  { key: 'app', dir: 'apps/app' },
  { key: 'ui', dir: 'apps/ui' },
  { key: 'api', dir: 'apps/api' },
  { key: 'client', dir: 'packages/client' },
  { key: 'kit', dir: 'packages/kit' },
  { key: 'metro', dir: 'packages/metro' },
];

/** All git-tracked files under the repo (respects .gitignore for free). */
function trackedFiles() {
  return execSync('git ls-files', { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n')
    .filter(Boolean);
}

function isCode(path) {
  const ext = path.split('.').pop();
  if (!ext || !CODE_EXT.has(ext.toLowerCase())) return false;
  // skip lockfiles, generated typings, and vendored node_modules
  if (path.includes('node_modules/')) return false;
  if (path.endsWith('package-lock.json') || path.endsWith('bun.lock')) return false;
  if (path.endsWith('.d.ts')) return false;
  return true;
}

function countLines(path) {
  try {
    const buf = readFileSync(join(ROOT, path));
    if (buf.length === 0) return 0;
    let n = 0;
    for (let i = 0; i < buf.length; i++) if (buf[i] === 10) n++;
    // count a trailing line with no final newline
    if (buf[buf.length - 1] !== 10) n++;
    return n;
  } catch {
    return 0;
  }
}

function humanize(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function badge(key, count) {
  return {
    schemaVersion: 1,
    label: LABEL,
    message: humanize(count),
    color: COLOR,
  };
}

function writeIfChanged(file, obj) {
  const next = `${JSON.stringify(obj, null, 2)}\n`;
  const prev = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (prev === next) return false;
  writeFileSync(file, next);
  return true;
}

function main() {
  const check = process.argv.includes('--check');
  if (!existsSync(BADGES_DIR)) mkdirSync(BADGES_DIR, { recursive: true });

  const files = trackedFiles().filter(isCode);
  const counts = Object.fromEntries(WORKSPACES.map((w) => [w.key, 0]));
  let total = 0;

  for (const f of files) {
    const lines = countLines(f);
    total += lines;
    for (const w of WORKSPACES) {
      if (f.startsWith(`${w.dir}/`)) {
        counts[w.key] += lines;
        break;
      }
    }
  }

  let changed = false;
  for (const w of WORKSPACES) {
    const file = join(BADGES_DIR, `loc-${w.key}.json`);
    if (writeIfChanged(file, badge(w.key, counts[w.key]))) changed = true;
    console.log(`${w.key.padEnd(8)} ${String(counts[w.key]).padStart(7)} lines`);
  }
  const totalFile = join(BADGES_DIR, 'loc-total.json');
  if (writeIfChanged(totalFile, badge('total', total))) changed = true;
  console.log(`${'TOTAL'.padEnd(8)} ${String(total).padStart(7)} lines`);

  if (check && changed) {
    console.error('\nLOC badges are out of date. Run: node scripts/loc-badge.mjs');
    process.exit(1);
  }
}

main();
