#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import madge from 'madge';
import { madgeConfig } from '../madge/index.js';

const cwd = process.cwd();
const exists = (rel) => existsSync(resolve(cwd, rel));

const childSrcRoots = (parent) => {
  const parentDir = resolve(cwd, parent);
  if (!existsSync(parentDir) || !statSync(parentDir).isDirectory()) return [];
  return readdirSync(parentDir)
    .map((name) => join(parent, name, 'src'))
    .filter((rel) => exists(rel) && statSync(resolve(cwd, rel)).isDirectory());
};

const discoverRoots = () => {
  const pkgPath = resolve(cwd, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      if (Array.isArray(pkg?.madge?.roots) && pkg.madge.roots.length > 0) return pkg.madge.roots;
    } catch {
      return ['src'];
    }
  }

  const globbed = [...childSrcRoots('apps'), ...childSrcRoots('packages')];
  if (globbed.length > 0) return globbed;

  return ['src'];
};

const argvRoots = process.argv.slice(2);
const roots = argvRoots.length > 0 ? argvRoots : discoverRoots();

const res = await madge(roots, madgeConfig);
const circular = res.circular();

if (circular.length === 0) {
  console.log('madge: no circular dependencies found across', roots.length, roots.length === 1 ? 'source root.' : 'source roots.');
  process.exit(0);
}

console.log(`madge: ${circular.length} circular dependenc${circular.length === 1 ? 'y' : 'ies'} found:\n`);
for (const cycle of circular) console.log('  ' + cycle.join(' → '));
process.exit(1);
