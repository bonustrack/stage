/** Workspace scan for `packages/*-station/` packages with `"metroStation": true`. */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { errMsg, log } from './log.js';
import type { Station } from './types.js';

/** Walk up from `from` looking for a package.json with a `workspaces` field. */
export function findWorkspaceRoot(from: string = process.cwd()): string | null {
  let dir = resolve(from);
  while (true) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { workspaces?: unknown };
        if (pkg.workspaces) return dir;
      } catch { /* malformed — keep walking */ }
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Each discovered station: package dir + the entry module path to import. */
export interface DiscoveredStation {
  dir: string;
  packageName: string;
  entry: string;
}

/** Scan `<root>/packages/*-station/package.json` for `metroStation === true`. */
export function discoverStationPackages(root: string): DiscoveredStation[] {
  const packagesDir = join(root, 'packages');
  if (!existsSync(packagesDir)) return [];
  const out: DiscoveredStation[] = [];
  for (const name of readdirSync(packagesDir)) {
    if (!name.endsWith('-station')) continue;
    const dir = join(packagesDir, name);
    const pkgPath = join(dir, 'package.json');
    if (!existsSync(pkgPath)) continue;
    let pkg: { name?: string; main?: string; module?: string; metroStation?: boolean };
    try { pkg = JSON.parse(readFileSync(pkgPath, 'utf8')); }
    catch (err) { log.warn({ err: errMsg(err), pkgPath }, 'discovery: skipping malformed package.json'); continue; }
    if (pkg.metroStation !== true) continue;
    const entryRel = pkg.module ?? pkg.main ?? 'index.ts';
    out.push({ dir, packageName: pkg.name ?? name, entry: join(dir, entryRel) });
  }
  return out;
}

/** Dynamically import `entry` and validate the default export looks like a Station. */
export async function loadStation(entry: string): Promise<Station | null> {
  try {
    const mod = (await import(pathToFileURL(entry).href)) as { default?: unknown };
    const candidate = mod.default;
    if (!isStation(candidate)) {
      log.warn({ entry }, 'discovery: default export is not a Station — skipping');
      return null;
    }
    return candidate;
  } catch (err) {
    log.warn({ err: errMsg(err), entry }, 'discovery: import failed — skipping station');
    return null;
  }
}

/** Structural check — no zod, just `typeof` on the five required slots. */
function isStation(v: unknown): v is Station {
  if (!v || typeof v !== 'object') return false;
  const s = v as Partial<Station>;
  return typeof s.name === 'string'
    && typeof s.configured === 'function'
    && typeof s.start === 'function'
    && typeof s.stop === 'function'
    && !!s.actions && typeof s.actions === 'object';
}
