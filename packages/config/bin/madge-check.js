#!/usr/bin/env node
import madge from 'madge';
import { madgeConfig } from '../madge/index.js';

const roots = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['src'];

const res = await madge(roots, madgeConfig);
const circular = res.circular();

if (circular.length === 0) {
  console.log('madge: no circular dependencies found across', roots.length, roots.length === 1 ? 'source root.' : 'source roots.');
  process.exit(0);
}

console.log(`madge: ${circular.length} circular dependenc${circular.length === 1 ? 'y' : 'ies'} found:\n`);
for (const cycle of circular) console.log('  ' + cycle.join(' → '));
process.exit(1);
