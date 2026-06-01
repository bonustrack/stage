/**
 * Tests for the monitor's `GET /api/tail` SSE stream + misc `/api/*` paths.
 * Companion to monitor.test.ts (auth + /api/state); shared harness in monitor-helpers.ts.
 */

import { describe, test } from 'bun:test';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TOKEN, expect, makeCtx, registerCleanup, startServer, freshStateDir, seedHistory,
} from './monitor-helpers.ts';

const ctx = makeCtx();
registerCleanup(ctx);

describe('GET /api/tail (SSE)', () => {
  test('streams initial backlog with ?since=0', async () => {
    const stateDir = freshStateDir(ctx);
    seedHistory(stateDir, [
      {
        id: 'msg_111', ts: '2026-05-17T00:00:00.000Z', kind: 'inbound', station: 'discord',
        line: 'metro://discord/1', from: 'metro://discord/user/x', to: 'metro://discord/1', text: 'first',
      },
    ]);
    ctx.server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });

    const ctrl = new AbortController();
    const r = await fetch(`${ctx.server.url}/api/tail?since=0`, {
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

  test('400 on non-numeric ?since (mirrors CLI --since validation, not silent EOF)', async () => {
    const stateDir = freshStateDir(ctx);
    ctx.server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });
    const r = await fetch(`${ctx.server.url}/api/tail?since=abc`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(r.status).toBe(400);
    const j = await r.json() as { error: string };
    expect(j.error).toContain('byte offset');
  });

  test('400 on negative ?since', async () => {
    const stateDir = freshStateDir(ctx);
    ctx.server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });
    const r = await fetch(`${ctx.server.url}/api/tail?since=-5`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(r.status).toBe(400);
  });

  test('appended events arrive after initial drain', async () => {
    const stateDir = freshStateDir(ctx);
    seedHistory(stateDir, [
      {
        id: 'msg_old', ts: '2026-05-17T00:00:00.000Z', kind: 'inbound', station: 'discord',
        line: 'metro://discord/1', from: 'metro://discord/user/x', to: 'metro://discord/1', text: 'pre',
      },
    ]);
    ctx.server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });

    const ctrl = new AbortController();
    /** Default since=tail — EOF cursor; backlog NOT replayed. */
    const r = await fetch(`${ctx.server.url}/api/tail`, {
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
    const stateDir = freshStateDir(ctx);
    ctx.server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });
    const r = await fetch(`${ctx.server.url}/api/nope`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(r.status).toBe(404);
  });

  test('POST /api/state → 405 (read-only)', async () => {
    const stateDir = freshStateDir(ctx);
    ctx.server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });
    const r = await fetch(`${ctx.server.url}/api/state`, {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(r.status).toBe(405);
  });
});
