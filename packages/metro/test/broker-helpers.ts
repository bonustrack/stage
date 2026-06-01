/** Shared fixtures + CLI runner for the broker tests (broker-*.test.ts). */

import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const CLI = join(ROOT, 'dist', 'cli', 'index.js');

export const WORKER_A = 'metro://user/worker-a';
export const WORKER_B = 'metro://user/worker-b';
export const CHAT_LINE = 'metro://discord/g/123/c/456';
export const WEBHOOK_LINE = 'metro://webhook/gh-main';

/** Per-file mutable test context: the active sandbox dir + dirs to clean up. */
export const env = { STATE_DIR: '', tempRoots: [] as string[] };

export function freshStateDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'metro-test-'));
  env.tempRoots.push(d);
  return d;
}

export function cleanupAll(): void {
  for (const d of env.tempRoots) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

type RunOpts = { env?: Record<string, string> };
export function runCli(args: string[], opts: RunOpts = {}): { stdout: string; stderr: string; status: number } {
  const childEnv = {
    ...process.env,
    METRO_STATE_DIR: env.STATE_DIR,
    METRO_CONFIG_DIR: join(env.STATE_DIR, 'config'),
    /** prevent userSelf() autodetect from picking up host env */
    CLAUDECODE: '',
    METRO_CODEX_RC: '',
    CODEX_HOME: '',
    /**
     * Short-circuit claudeUserId() — without these, CLAUDECODE=1 in test
     * env triggers `claude auth status --json` which fails in CI (no claude
     * CLI installed) and the CLI exits 1.
     */
    METRO_USER_ID: 'test-user',
    METRO_USER_SESSION_ID: 'test-session',
    ...(opts.env ?? {}),
  };
  const r = spawnSync('node', [CLI, ...args], { env: childEnv, encoding: 'utf8' });
  return { stdout: r.stdout, stderr: r.stderr, status: r.status ?? 0 };
}

export function readClaims(): Record<string, string> {
  const f = join(env.STATE_DIR, 'claims.json');
  if (!existsSync(f)) return {};
  return JSON.parse(readFileSync(f, 'utf8'));
}

export function writeClaim(line: string, owner: string): void {
  writeFileSync(join(env.STATE_DIR, 'claims.json'), JSON.stringify({ [line]: owner }, null, 2) + '\n');
}

/** Seed history directly so we don't need a live dispatcher to exercise tail filters. */
export function appendHistoryLine(entry: Record<string, unknown>): void {
  mkdirSync(env.STATE_DIR, { recursive: true });
  appendFileSync(join(env.STATE_DIR, 'history.jsonl'), JSON.stringify(entry) + '\n');
}

/** The standard 3-entry history (discord chat, webhook, telegram) used by tail tests. */
export function seedHistory(): void {
  appendHistoryLine({
    id: 'msg_1', ts: '2026-05-16T00:00:00Z', kind: 'inbound', station: 'discord',
    line: CHAT_LINE, from: 'metro://discord/u/alice', to: CHAT_LINE, text: 'hello',
  });
  appendHistoryLine({
    id: 'msg_2', ts: '2026-05-16T00:00:01Z', kind: 'inbound', station: 'webhook',
    line: WEBHOOK_LINE, from: WEBHOOK_LINE, to: WEBHOOK_LINE, text: 'gh push',
  });
  appendHistoryLine({
    id: 'msg_3', ts: '2026-05-16T00:00:02Z', kind: 'inbound', station: 'telegram',
    line: 'metro://telegram/-100/1', from: 'metro://telegram/u/bob',
    to: 'metro://telegram/-100/1', text: 'tg-msg',
  });
}
