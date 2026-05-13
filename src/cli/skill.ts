/** `metro setup skill` — install the bundled SKILL.md into each detected agent runtime. */

import { copyFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { errMsg } from '../log.js';
import { emit, exitErr, type Flags } from './util.js';

type Runtime = 'claude-code' | 'codex';
const RUNTIME_DIRS: Record<Runtime, string> = {
  'claude-code': join(homedir(), '.claude', 'skills', 'metro'),
  codex: join(homedir(), '.codex', 'skills', 'metro'),
};

/** dist/cli/skill.js → <package-root>/skills/metro/SKILL.md */
const bundledPath = (): string =>
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'metro', 'SKILL.md');

const dest = (r: Runtime): string => join(RUNTIME_DIRS[r], 'SKILL.md');

export const skillStatus = (): Record<Runtime, boolean> => ({
  'claude-code': existsSync(dest('claude-code')),
  codex: existsSync(dest('codex')),
});

export async function cmdSetupSkill(p: string[], f: Flags): Promise<void> {
  const [sub] = p;
  if (sub === 'clear') return clear(f);
  if (sub && sub !== 'install') throw exitErr(`unknown skill subcommand '${sub}' (try: install, clear)`, 1);
  return install(f);
}

function install(f: Flags): void {
  const src = bundledPath();
  if (!existsSync(src)) throw exitErr(`bundled SKILL.md missing at ${src} (broken install?)`, 2);
  const installed: string[] = [];
  for (const r of Object.keys(RUNTIME_DIRS) as Runtime[]) {
    if (!existsSync(join(homedir(), r === 'claude-code' ? '.claude' : '.codex'))) continue;
    try {
      mkdirSync(RUNTIME_DIRS[r], { recursive: true });
      copyFileSync(src, dest(r));
      installed.push(dest(r));
    } catch (err) { throw exitErr(`failed to install skill for ${r}: ${errMsg(err)}`, 2); }
  }
  if (!installed.length) {
    throw exitErr('no agent runtime detected (~/.claude or ~/.codex). Install one and rerun.', 2);
  }
  emit(f, `installed metro skill → ${installed.join(', ')}`, { ok: true, installed });
}

function clear(f: Flags): void {
  const removed: string[] = [];
  for (const r of Object.keys(RUNTIME_DIRS) as Runtime[]) {
    const path = dest(r);
    if (existsSync(path)) { try { unlinkSync(path); removed.push(path); } catch { /* ignore */ } }
  }
  emit(f, removed.length ? `removed metro skill from ${removed.join(', ')}` : 'no installed skill found',
    { ok: true, removed });
}
