/**
 * Tests for the two PR-30 follow-ups:
 *  1. Auto-claim on outbound (with --no-claim + METRO_NO_AUTO_CLAIM opt-outs, never overwrites foreign claim).
 *  2. Webhooks excluded from `--as <id>` modes by default, surface in --unclaimed/--all, opt-in --include-webhooks.
 *
 * Tests are end-to-end via the `metro` CLI in a sandboxed METRO_STATE_DIR. No real network.
 */

import { describe, expect, test, beforeEach, afterAll } from 'bun:test';
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const CLI = join(ROOT, 'dist', 'cli', 'index.js');

let STATE_DIR = '';
const tempRoots: string[] = [];

function freshStateDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'metro-test-'));
  tempRoots.push(d);
  return d;
}

afterAll(() => {
  for (const d of tempRoots) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

beforeEach(() => {
  STATE_DIR = freshStateDir();
});

type RunOpts = { env?: Record<string, string> };
function runCli(args: string[], opts: RunOpts = {}): { stdout: string; stderr: string; status: number } {
  const env = {
    ...process.env,
    METRO_STATE_DIR: STATE_DIR,
    METRO_CONFIG_DIR: join(STATE_DIR, 'config'),
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
  const r = spawnSync('node', [CLI, ...args], { env, encoding: 'utf8' });
  return { stdout: r.stdout, stderr: r.stderr, status: r.status ?? 0 };
}

function readClaims(): Record<string, string> {
  const f = join(STATE_DIR, 'claims.json');
  if (!existsSync(f)) return {};
  return JSON.parse(readFileSync(f, 'utf8'));
}

function writeClaim(line: string, owner: string): void {
  writeFileSync(join(STATE_DIR, 'claims.json'), JSON.stringify({ [line]: owner }, null, 2) + '\n');
}

/** Seed history directly so we don't need a live dispatcher to exercise tail filters. */
function appendHistoryLine(entry: Record<string, unknown>): void {
  mkdirSync(STATE_DIR, { recursive: true });
  appendFileSync(join(STATE_DIR, 'history.jsonl'), JSON.stringify(entry) + '\n');
}

const WORKER_A = 'metro://user/worker-a';
const WORKER_B = 'metro://user/worker-b';
const CHAT_LINE = 'metro://discord/g/123/c/456';
const WEBHOOK_LINE = 'metro://webhook/gh-main';

/** In-process tests — drive the broker primitive directly. Real station IO is bypassed. */
/** The broker module reads `STATE_DIR` ONCE at import time, so all tests share one dir */
/** that we reset between cases via the file deletions below. */
import {
  tryAutoClaim,
  classifyLine,
  readClaims as brokerReadClaims,
  CLAIMS_FILE, HISTORY_FILE,
} from '../src/broker/claims.ts';
import { passesMode, cursorKey } from '../src/broker/history-stream.ts';
import { asLine } from '../src/lines.ts';
import type { HistoryEntry } from '../src/history.ts';
import { unlinkSync } from 'node:fs';

function resetBrokerClaims(): void {
  try { unlinkSync(CLAIMS_FILE); } catch { /* not there yet */ }
}

function resetBrokerHistory(): void {
  try { unlinkSync(HISTORY_FILE); } catch { /* not there yet */ }
}

/** Append directly to the broker's resolved history path so in-process tests can read what they write. */
function appendToBrokerHistory(entry: Record<string, unknown>): void {
  mkdirSync(require('node:path').dirname(HISTORY_FILE), { recursive: true });
  appendFileSync(HISTORY_FILE, JSON.stringify(entry) + '\n');
}

describe('tryAutoClaim (broker primitive used by outbound actions)', () => {
  test('writes claim when line is unclaimed', () => {
    resetBrokerClaims();
    const r = tryAutoClaim(asLine(CHAT_LINE), asLine(WORKER_A));
    expect(r.status).toBe('claimed');
    expect(brokerReadClaims()[CHAT_LINE]).toBe(WORKER_A);
  });

  test('returns kept when owner already matches', () => {
    resetBrokerClaims();
    tryAutoClaim(asLine(CHAT_LINE), asLine(WORKER_A));
    const r = tryAutoClaim(asLine(CHAT_LINE), asLine(WORKER_A));
    expect(r.status).toBe('kept');
  });

  test('does NOT overwrite a foreign owner', () => {
    resetBrokerClaims();
    tryAutoClaim(asLine(CHAT_LINE), asLine(WORKER_A));
    const r = tryAutoClaim(asLine(CHAT_LINE), asLine(WORKER_B));
    expect(r.status).toBe('skipped');
    if (r.status === 'skipped') expect(r.existing).toBe(WORKER_A);
    expect(brokerReadClaims()[CHAT_LINE]).toBe(WORKER_A);
  });

  test('skips group-classified line (issue #34)', () => {
    resetBrokerClaims();
    const r = tryAutoClaim(asLine(CHAT_LINE), asLine(WORKER_A), { lineKind: 'group' });
    expect(r.status).toBe('group');
    expect(brokerReadClaims()[CHAT_LINE]).toBeUndefined();
  });

  test('--claim (force) bypasses group-skip', () => {
    resetBrokerClaims();
    const r = tryAutoClaim(asLine(CHAT_LINE), asLine(WORKER_A), { lineKind: 'group', force: true });
    expect(r.status).toBe('claimed');
    expect(brokerReadClaims()[CHAT_LINE]).toBe(WORKER_A);
  });

  test('skips webhook lines outright regardless of kind', () => {
    resetBrokerClaims();
    const r = tryAutoClaim(asLine('metro://webhook/gh-main'), asLine(WORKER_A), { lineKind: 'dm' });
    expect(r.status).toBe('webhook');
    expect(brokerReadClaims()['metro://webhook/gh-main']).toBeUndefined();
  });

  test('claude/codex lines always claim regardless of kind', () => {
    resetBrokerClaims();
    const r = tryAutoClaim(asLine('metro://claude/user/abc/sess1'), asLine(WORKER_A), { lineKind: 'group' });
    expect(r.status).toBe('claimed');
    expect(brokerReadClaims()['metro://claude/user/abc/sess1']).toBe(WORKER_A);
  });
});

describe('classifyLine (issue #34: DM vs group detection)', () => {
  test('telegram positive chat id ⇒ dm', () => {
    expect(classifyLine(asLine('metro://telegram/25220238'))).toBe('dm');
  });

  test('telegram negative chat id ⇒ group', () => {
    expect(classifyLine(asLine('metro://telegram/-1003950444088'))).toBe('group');
  });

  test('telegram negative chat id with topic ⇒ group', () => {
    expect(classifyLine(asLine('metro://telegram/-1003950444088/42'))).toBe('group');
  });

  test('claude/codex lines ⇒ dm', () => {
    expect(classifyLine(asLine('metro://claude/user/abc/sess1'))).toBe('dm');
    expect(classifyLine(asLine('metro://codex/user/xyz/thread1'))).toBe('dm');
  });

  test('webhook line ⇒ group (broker also short-circuits via webhook rule)', () => {
    expect(classifyLine(asLine('metro://webhook/gh-main'))).toBe('group');
  });

  test('discord with no inbound history ⇒ unknown', () => {
    /** No history seeded → unknown → broker treats as claim-eligible (conservative). */
    expect(classifyLine(asLine('metro://discord/9999999'))).toBe('unknown');
  });

  test('discord inbound payload.guildId == null ⇒ dm', () => {
    resetBrokerHistory();
    const dmLine = 'metro://discord/dm-channel-id';
    appendToBrokerHistory({
      id: 'msg_dm', ts: '2026-05-16T00:00:00Z', kind: 'inbound', station: 'discord',
      line: dmLine, from: 'metro://discord/u/alice', to: 'metro://discord/u/me',
      text: 'hi', payload: { guildId: null },
    });
    expect(classifyLine(asLine(dmLine))).toBe('dm');
  });

  test('discord inbound payload.guildId != null ⇒ group', () => {
    resetBrokerHistory();
    const guildLine = 'metro://discord/guild-channel-id';
    appendToBrokerHistory({
      id: 'msg_g', ts: '2026-05-16T00:00:00Z', kind: 'inbound', station: 'discord',
      line: guildLine, from: 'metro://discord/u/alice', to: guildLine,
      text: 'hi', payload: { guildId: '123456' },
    });
    expect(classifyLine(asLine(guildLine))).toBe('group');
  });
});

describe('cursorKey (issue #34: mode-derived cursor key)', () => {
  test('--as=<id> mine-or-unclaimed → userSlug(id)', () => {
    expect(cursorKey('mine-or-unclaimed', asLine('metro://claude/user/abc')))
      .toBe('claude-user-abc');
  });

  test('--as=<id> --strict adds suffix', () => {
    expect(cursorKey('mine-only', asLine('metro://claude/user/abc')))
      .toBe('claude-user-abc--strict');
  });

  test('--as=<id> --include-webhooks adds suffix', () => {
    expect(cursorKey('mine-or-unclaimed', asLine('metro://claude/user/abc'), { includeWebhooks: true }))
      .toBe('claude-user-abc--with-webhooks');
  });

  test('--unclaimed → _unclaimed', () => {
    expect(cursorKey('unclaimed', null)).toBe('_unclaimed');
    /** even with self set, mode trumps */
    expect(cursorKey('unclaimed', asLine('metro://claude/user/abc'))).toBe('_unclaimed');
  });

  test('--all → _all', () => {
    expect(cursorKey('all', null)).toBe('_all');
    expect(cursorKey('all', asLine('metro://claude/user/abc'))).toBe('_all');
  });

  test('no mode, no self → null (no cursor)', () => {
    /** mine-only without self can't be constructed; this matches "no self" path */
    expect(cursorKey('mine-or-unclaimed', null)).toBe(null);
  });

  test('_-prefixed mode keys never collide with a real userSlug', () => {
    /** userSlug always contains a station prefix (claude-…, codex-…, discord-…); none start with `_`. */
    const k = cursorKey('all', asLine('metro://claude/user/abc'));
    expect(k?.startsWith('_')).toBe(true);
    const u = cursorKey('mine-or-unclaimed', asLine('metro://claude/user/abc'));
    expect(u?.startsWith('_')).toBe(false);
  });
});

describe('passesMode webhook gating', () => {
  const webhookEvent: HistoryEntry = {
    id: 'msg_w1', ts: '2026-05-16T00:00:00Z', kind: 'inbound', station: 'webhook',
    line: asLine(WEBHOOK_LINE), from: asLine('metro://webhook/gh-main'), to: asLine(WEBHOOK_LINE),
    text: 'push to main',
  };
  const chatEvent: HistoryEntry = {
    id: 'msg_c1', ts: '2026-05-16T00:00:01Z', kind: 'inbound', station: 'discord',
    line: asLine(CHAT_LINE), from: asLine('metro://discord/u/alice'), to: asLine(CHAT_LINE),
    text: 'hi',
  };
  const claims = {};

  test('mine-or-unclaimed: chat passes, webhook does NOT (default)', () => {
    expect(passesMode(chatEvent, 'mine-or-unclaimed', asLine(WORKER_A), claims)).toBe(true);
    expect(passesMode(webhookEvent, 'mine-or-unclaimed', asLine(WORKER_A), claims)).toBe(false);
  });

  test('mine-only: webhook still excluded by default', () => {
    expect(passesMode(webhookEvent, 'mine-only', asLine(WORKER_A), { [WEBHOOK_LINE]: WORKER_A })).toBe(false);
  });

  test('mine-or-unclaimed + includeWebhooks: webhook passes', () => {
    expect(passesMode(webhookEvent, 'mine-or-unclaimed', asLine(WORKER_A), claims, { includeWebhooks: true })).toBe(true);
  });

  test('mine-only + includeWebhooks + claim match: webhook passes', () => {
    expect(passesMode(
      webhookEvent, 'mine-only', asLine(WORKER_A), { [WEBHOOK_LINE]: WORKER_A }, { includeWebhooks: true },
    )).toBe(true);
  });

  test('unclaimed: webhook passes (router sees ownerless events)', () => {
    expect(passesMode(webhookEvent, 'unclaimed', asLine(WORKER_A), claims)).toBe(true);
  });

  test('all: webhook passes (operator sees everything)', () => {
    expect(passesMode(webhookEvent, 'all', null, claims)).toBe(true);
  });
});

describe('metro tail --as <id> end-to-end', () => {
  function seedHistory(): void {
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

  test('default --as worker-a hides webhook', () => {
    seedHistory();
    const r = runCli(['tail', '--as', WORKER_A, '--limit', '10', '--json']);
    expect(r.status).toBe(0);
    const ids = r.stdout.trim().split('\n').filter(Boolean).map(l => JSON.parse(l).id);
    expect(ids).toContain('msg_1');
    expect(ids).toContain('msg_3');
    expect(ids).not.toContain('msg_2');
  });

  test('--as worker-a --include-webhooks shows webhook', () => {
    seedHistory();
    const r = runCli(['tail', '--as', WORKER_A, '--include-webhooks', '--limit', '10', '--json']);
    expect(r.status).toBe(0);
    const ids = r.stdout.trim().split('\n').filter(Boolean).map(l => JSON.parse(l).id);
    expect(ids).toContain('msg_2');
  });

  test('--unclaimed shows webhook', () => {
    seedHistory();
    const r = runCli(['tail', '--unclaimed', '--limit', '10', '--json']);
    expect(r.status).toBe(0);
    const ids = r.stdout.trim().split('\n').filter(Boolean).map(l => JSON.parse(l).id);
    expect(ids).toContain('msg_2');
  });

  test('--all shows webhook', () => {
    seedHistory();
    const r = runCli(['tail', '--all', '--limit', '10', '--json']);
    expect(r.status).toBe(0);
    const ids = r.stdout.trim().split('\n').filter(Boolean).map(l => JSON.parse(l).id);
    expect(ids).toContain('msg_2');
  });

  test('claim by foreign owner excludes claimed line from worker-a mine-or-unclaimed', () => {
    seedHistory();
    writeClaim(CHAT_LINE, WORKER_B);
    const r = runCli(['tail', '--as', WORKER_A, '--limit', '10', '--json']);
    const ids = r.stdout.trim().split('\n').filter(Boolean).map(l => JSON.parse(l).id);
    expect(ids).not.toContain('msg_1');
  });
});

describe('metro tail cursor independence (issue #34)', () => {
  function seedHistory(): void {
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

  test('--all writes cursors/_all, not cursors/<userSelf>', () => {
    seedHistory();
    const r = runCli(['tail', '--all', '--json'], { env: { CLAUDECODE: '1' } });
    expect(r.status).toBe(0);
    expect(existsSync(join(STATE_DIR, 'cursors', '_all'))).toBe(true);
    /** No per-user cursor should be written by an --all tail. */
    const cursorsDir = join(STATE_DIR, 'cursors');
    const files = require('node:fs').readdirSync(cursorsDir) as string[];
    expect(files).toContain('_all');
    expect(files.some(f => f.startsWith('claude-user-'))).toBe(false);
  });

  test('--unclaimed writes cursors/_unclaimed', () => {
    seedHistory();
    const r = runCli(['tail', '--unclaimed', '--json'], { env: { CLAUDECODE: '1' } });
    expect(r.status).toBe(0);
    expect(existsSync(join(STATE_DIR, 'cursors', '_unclaimed'))).toBe(true);
  });

  test('--as=<me> writes cursors/<userSlug>', () => {
    seedHistory();
    const r = runCli(['tail', '--as', WORKER_A, '--json']);
    expect(r.status).toBe(0);
    /** userSlug('metro://user/worker-a') == 'user-worker-a' */
    expect(existsSync(join(STATE_DIR, 'cursors', 'user-worker-a'))).toBe(true);
  });

  test('--all then --as=<me> emit independently (the regression fix)', () => {
    seedHistory();
    /** First: --all consumes everything, writes _all. */
    const allRun = runCli(['tail', '--all', '--json'], { env: { CLAUDECODE: '1' } });
    expect(allRun.status).toBe(0);
    const allIds = allRun.stdout.trim().split('\n').filter(Boolean).map(l => JSON.parse(l).id);
    expect(allIds).toEqual(['msg_1', 'msg_2', 'msg_3']);

    /** Then: --as=<me> should still see fresh personal events (its cursor is independent). */
    const asRun = runCli(['tail', '--as', WORKER_A, '--json']);
    expect(asRun.status).toBe(0);
    const asIds = asRun.stdout.trim().split('\n').filter(Boolean).map(l => JSON.parse(l).id);
    /** Worker-A in mine-or-unclaimed: chat + telegram visible, webhook hidden. */
    expect(asIds).toContain('msg_1');
    expect(asIds).toContain('msg_3');
    expect(asIds).not.toContain('msg_2');
  });

  test('--include-webhooks gets a separate cursor from --as alone', () => {
    seedHistory();
    runCli(['tail', '--as', WORKER_A, '--json']);
    runCli(['tail', '--as', WORKER_A, '--include-webhooks', '--json']);
    const cursorsDir = join(STATE_DIR, 'cursors');
    const files = require('node:fs').readdirSync(cursorsDir) as string[];
    expect(files).toContain('user-worker-a');
    expect(files).toContain('user-worker-a--with-webhooks');
  });
});

describe('metro claim CLI auto-claim simulation', () => {
  /**
   * Auto-claim runs inside cmdSend/Reply/Edit/React. Those require a real platform side-effect
   * (Discord/Telegram API). We exercise the *logic* by calling `metro claim` (which uses the same
   * `withClaimsLock` path) — and the unit tests above cover `tryAutoClaim` directly.
   *
   * This integration block validates the CLI envelope (flags, env-var, exit codes).
   */

  test('metro claims is empty initially', () => {
    const r = runCli(['claims', '--json']);
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual({ claims: {} });
  });

  test('metro claim adds + metro release removes', () => {
    const c = runCli(['claim', CHAT_LINE, '--as', WORKER_A, '--json']);
    expect(c.status).toBe(0);
    expect(readClaims()[CHAT_LINE]).toBe(WORKER_A);
    const r = runCli(['release', CHAT_LINE, '--json']);
    expect(r.status).toBe(0);
    expect(readClaims()[CHAT_LINE]).toBeUndefined();
  });
});
