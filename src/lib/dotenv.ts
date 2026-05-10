// Tiny .env reader/writer. Used by `metro setup` (read/write the global
// config file) and by paths.ts (load env vars into process.env at startup).

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const LINE_RE = /^\s*([A-Za-z_]\w*)\s*=\s*(.*?)\s*$/;
const QUOTED_RE = /^(['"])(.*)\1$/;

export function readDotenv(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(LINE_RE);
    if (m) out[m[1]] = m[2].replace(QUOTED_RE, '$2');
  }
  return out;
}

export function writeDotenv(path: string, env: Record<string, string>): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
  chmodSync(path, 0o600);
}

// Load .env at `path` into process.env, but only for keys that aren't already
// set — first definer wins, so callers control precedence by the order they
// invoke this.
export function loadDotenvIntoProcess(path: string): void {
  for (const [k, v] of Object.entries(readDotenv(path))) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
