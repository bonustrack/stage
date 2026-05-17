/**
 * Tests for the read-only monitor HTTP endpoints (`/api/state`, `/api/tail`).
 *
 * Each test runs in a fresh subprocess so `METRO_STATE_DIR` is resolved cleanly
 * (the broker + monitor modules capture STATE_DIR at import time). The subprocess
 * imports `handleMonitorRequest` from `src/cli/tail.ts`, mounts it on an
 * ephemeral port, prints the port, then keeps running until killed.
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, appendFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HARNESS = fileURLToPath(new URL('./monitor-harness.mjs', import.meta.url));
const tempRoots: string[] = [];

type Server = { child: ChildProcessWithoutNullStreams; url: string };

async function startServer(env: Record<string, string>): Promise<Server> {
  const child = spawn('bun', [HARNESS], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  /** Harness prints the listening port on its first stdout line. */
  const port = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('harness did not announce port in 5s')), 5_000);
    let buf = '';
    child.stdout.on('data', chunk => {
      buf += chunk.toString();
      const nl = buf.indexOf('\n');
      if (nl !== -1) {
        clearTimeout(timeout);
        resolve(buf.slice(0, nl).trim());
      }
    });
    child.on('exit', code => {
      clearTimeout(timeout);
      reject(new Error(`harness exited early (code=${code})`));
    });
  });
  return { child, url: `http://127.0.0.1:${port}` };
}

function stopServer(s: Server): Promise<void> {
  return new Promise(resolve => {
    if (s.child.exitCode !== null) return resolve();
    s.child.once('exit', () => resolve());
    s.child.kill('SIGTERM');
    setTimeout(() => { try { s.child.kill('SIGKILL'); } catch { /* ignore */ } }, 1_000);
  });
}

function freshStateDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'metro-mon-test-'));
  tempRoots.push(d);
  return d;
}

function seedHistory(stateDir: string, entries: object[]): void {
  mkdirSync(stateDir, { recursive: true });
  appendFileSync(join(stateDir, 'history.jsonl'), entries.map(e => JSON.stringify(e)).join('\n') + '\n');
}

function seedClaims(stateDir: string, claims: Record<string, string>): void {
  writeFileSync(join(stateDir, 'claims.json'), JSON.stringify(claims, null, 2));
}

function seedBotIds(stateDir: string, botIds: Record<string, string>): void {
  writeFileSync(join(stateDir, 'bot-ids.json'), JSON.stringify(botIds, null, 2));
}

const TOKEN = 'test-token-abc';
let server: Server | null = null;

afterEach(async () => {
  if (server) { await stopServer(server); server = null; }
  for (const d of tempRoots.splice(0)) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

describe('monitor auth', () => {
  test('401 when no Authorization header', async () => {
    const stateDir = freshStateDir();
    server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });
    const r = await fetch(`${server.url}/api/state`);
    expect(r.status).toBe(401);
    const j = await r.json() as { error: string };
    expect(j.error).toBe('unauthorized');
  });

  test('401 with wrong bearer token', async () => {
    const stateDir = freshStateDir();
    server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });
    const r = await fetch(`${server.url}/api/state`, {
      headers: { authorization: 'Bearer not-the-right-token' },
    });
    expect(r.status).toBe(401);
  });

  test('401 with malformed Authorization (no Bearer prefix)', async () => {
    const stateDir = freshStateDir();
    server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });
    const r = await fetch(`${server.url}/api/state`, {
      headers: { authorization: TOKEN },
    });
    expect(r.status).toBe(401);
  });

  test('503 when METRO_MONITOR_TOKEN is unset', async () => {
    const stateDir = freshStateDir();
    /** Explicitly clear the env var inside the child. */
    server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: '' });
    const r = await fetch(`${server.url}/api/state`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(r.status).toBe(503);
    const j = await r.json() as { error: string };
    expect(j.error).toContain('not configured');
  });
});

describe('GET /api/state', () => {
  test('200 with claims, lines, recent_history, bot_ids', async () => {
    const stateDir = freshStateDir();
    seedHistory(stateDir, [
      {
        id: 'msg_aaa', ts: '2026-05-17T00:00:00.000Z', kind: 'inbound', station: 'discord',
        line: 'metro://discord/123', from: 'metro://discord/user/9', to: 'metro://discord/123', text: 'hi',
      },
      {
        id: 'msg_bbb', ts: '2026-05-17T00:00:01.000Z', kind: 'inbound', station: 'telegram',
        line: 'metro://telegram/456', from: 'metro://telegram/user/2', to: 'metro://telegram/456', text: 'ho',
      },
    ]);
    seedClaims(stateDir, { 'metro://discord/123': 'metro://claude/user/abc' });
    seedBotIds(stateDir, { discord: '999', telegram: '888' });

    server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });
    const r = await fetch(`${server.url}/api/state`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('application/json');
    const body = await r.json() as {
      claims: Record<string, string>;
      lines: string[];
      recent_history: Array<{ id: string }>;
      bot_ids: Record<string, string>;
    };
    expect(body.claims).toEqual({ 'metro://discord/123': 'metro://claude/user/abc' });
    expect(body.lines).toContain('metro://discord/123');
    expect(body.lines).toContain('metro://telegram/456');
    expect(body.recent_history.length).toBe(2);
    /** Most-recent-first. */
    expect(body.recent_history[0].id).toBe('msg_bbb');
    expect(body.bot_ids).toEqual({ discord: '999', telegram: '888' });
  });

  test('?before=N&limit=M returns the next page (newest-first, slice [N..N+M))', async () => {
    const stateDir = freshStateDir();
    /** Seed 5 entries — oldest first in the file (newest-first when read). */
    seedHistory(stateDir, [0, 1, 2, 3, 4].map(i => ({
      id: `msg_${i}`,
      ts: `2026-05-17T00:00:0${i}.000Z`,
      kind: 'inbound',
      station: 'discord',
      line: 'metro://discord/1',
      from: 'metro://discord/user/x',
      to: 'metro://discord/1',
      text: `e${i}`,
    })));
    server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });

    /** Page 2: skip 2 newest, return next 2 → msg_2, msg_1. */
    const r = await fetch(`${server.url}/api/state?before=2&limit=2`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(r.status).toBe(200);
    const body = await r.json() as { recent_history: Array<{ id: string }>; claims?: unknown };
    expect(body.recent_history.map(e => e.id)).toEqual(['msg_2', 'msg_1']);
    /** Pagination response is history-only — no claims/lines/bot_ids. */
    expect(body.claims).toBeUndefined();
  });

  test('?before past end returns empty page', async () => {
    const stateDir = freshStateDir();
    seedHistory(stateDir, [{
      id: 'msg_only', ts: '2026-05-17T00:00:00.000Z', kind: 'inbound', station: 'discord',
      line: 'metro://discord/1', from: 'metro://discord/user/x', to: 'metro://discord/1', text: 'x',
    }]);
    server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });
    const r = await fetch(`${server.url}/api/state?before=99&limit=20`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(r.status).toBe(200);
    const body = await r.json() as { recent_history: unknown[] };
    expect(body.recent_history).toEqual([]);
  });

  test('empty state — 200 with empty maps', async () => {
    const stateDir = freshStateDir();
    server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });
    const r = await fetch(`${server.url}/api/state`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(r.status).toBe(200);
    const body = await r.json() as {
      claims: Record<string, string>;
      lines: string[];
      recent_history: unknown[];
      bot_ids: Record<string, string>;
    };
    expect(body.claims).toEqual({});
    expect(body.lines).toEqual([]);
    expect(body.recent_history).toEqual([]);
    expect(body.bot_ids).toEqual({});
  });
});

describe('GET /api/tail (SSE)', () => {
  test('streams initial backlog with ?since=0', async () => {
    const stateDir = freshStateDir();
    seedHistory(stateDir, [
      {
        id: 'msg_111', ts: '2026-05-17T00:00:00.000Z', kind: 'inbound', station: 'discord',
        line: 'metro://discord/1', from: 'metro://discord/user/x', to: 'metro://discord/1', text: 'first',
      },
    ]);
    server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });

    const ctrl = new AbortController();
    const r = await fetch(`${server.url}/api/tail?since=0`, {
      headers: { authorization: `Bearer ${TOKEN}` },
      signal: ctrl.signal,
    });
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('text/event-stream');

    const reader = r.body!.getReader();
    const dec = new TextDecoder();
    let buf = '';
    const deadline = Date.now() + 3_000;
    while (!buf.includes('msg_111') && Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
    }
    ctrl.abort();
    expect(buf).toContain('event: history');
    expect(buf).toContain('msg_111');
    expect(buf).toContain('"text":"first"');
  });

  test('appended events arrive after initial drain', async () => {
    const stateDir = freshStateDir();
    seedHistory(stateDir, [
      {
        id: 'msg_old', ts: '2026-05-17T00:00:00.000Z', kind: 'inbound', station: 'discord',
        line: 'metro://discord/1', from: 'metro://discord/user/x', to: 'metro://discord/1', text: 'pre',
      },
    ]);
    server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });

    const ctrl = new AbortController();
    /** Default since=tail — EOF cursor; backlog NOT replayed. */
    const r = await fetch(`${server.url}/api/tail`, {
      headers: { authorization: `Bearer ${TOKEN}` },
      signal: ctrl.signal,
    });
    expect(r.status).toBe(200);
    const reader = r.body!.getReader();
    const dec = new TextDecoder();

    /** Give the handler a moment to install its watcher, then append a fresh entry. */
    await new Promise(res => setTimeout(res, 200));
    appendFileSync(
      join(stateDir, 'history.jsonl'),
      JSON.stringify({
        id: 'msg_new', ts: '2026-05-17T00:01:00.000Z', kind: 'inbound', station: 'discord',
        line: 'metro://discord/1', from: 'metro://discord/user/x', to: 'metro://discord/1', text: 'live',
      }) + '\n',
    );

    let buf = '';
    const deadline = Date.now() + 5_000;
    while (!buf.includes('msg_new') && Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
    }
    ctrl.abort();
    expect(buf).toContain('msg_new');
    expect(buf).toContain('"text":"live"');
    expect(buf).not.toContain('msg_old');
  });
});

describe('GET /api/* misc', () => {
  test('unknown /api/* path → 404', async () => {
    const stateDir = freshStateDir();
    server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });
    const r = await fetch(`${server.url}/api/nope`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(r.status).toBe(404);
  });

  test('POST /api/state → 405 (read-only)', async () => {
    const stateDir = freshStateDir();
    server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });
    const r = await fetch(`${server.url}/api/state`, {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(r.status).toBe(405);
  });
});
