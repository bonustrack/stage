/** Persist GitHub Line → chat-station Line so a follow-up mention reuses the same thread. */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { errMsg, log } from '../../log.js';
import { STATE_DIR } from '../../paths.js';
import type { Line } from '../types.js';

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

export const getBridge = (github: Line): Line | undefined => read()[github] as Line | undefined;
export const setBridge = (github: Line, chat: Line): void => { const m = read(); m[github] = chat; write(m); };
