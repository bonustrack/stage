/** Persist `github:repo#N` → chat scope key (e.g. `discord:THREAD`) so a follow-up mention reuses the same thread. */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { errMsg, log } from '../log.js';
import { STATE_DIR } from '../paths.js';

const file = join(STATE_DIR, 'github-bridges.json');

const read = (): Record<string, string> => {
  if (!existsSync(file)) return {};
  try { return JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>; }
  catch (err) { log.warn({ err: errMsg(err) }, 'github-bridges: read failed; treating as empty'); return {}; }
};

const write = (map: Record<string, string>): void => {
  try { writeFileSync(file, JSON.stringify(map, null, 2)); }
  catch (err) { log.warn({ err: errMsg(err) }, 'github-bridges: write failed'); }
};

export const getBridge = (githubScope: string): string | undefined => read()[githubScope];
export const setBridge = (githubScope: string, chatScope: string): void => { const m = read(); m[githubScope] = chatScope; write(m); };
