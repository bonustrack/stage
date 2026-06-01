/**
 * Tests for the read-only monitor HTTP endpoints (auth + `/api/state`).
 * Shared subprocess harness lives in `monitor-helpers.ts`; `/api/tail` lives in
 * `monitor-tail.test.ts` and POST /api/call in `monitor-call.test.ts`.
 */

import { describe, test } from 'bun:test';
import {
  TOKEN, expect, makeCtx, registerCleanup, startServer, freshStateDir, seedHistory, seedClaims, seedBotIds,
} from './monitor-helpers.ts';

const ctx = makeCtx();
registerCleanup(ctx);

describe('monitor auth', () => {
  test('401 when no Authorization header', async () => {
    const stateDir = freshStateDir(ctx);
    ctx.server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });
    const r = await fetch(`${ctx.server.url}/api/state`);
    expect(r.status).toBe(401);
    const j = await r.json() as { error: string };
    expect(j.error).toBe('unauthorized');
  });

  test('401 with wrong bearer token', async () => {
    const stateDir = freshStateDir(ctx);
    ctx.server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });
    const r = await fetch(`${ctx.server.url}/api/state`, {
      headers: { authorization: 'Bearer not-the-right-token' },
    });
    expect(r.status).toBe(401);
  });

  test('401 with malformed Authorization (no Bearer prefix)', async () => {
    const stateDir = freshStateDir(ctx);
    ctx.server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });
    const r = await fetch(`${ctx.server.url}/api/state`, {
      headers: { authorization: TOKEN },
    });
    expect(r.status).toBe(401);
  });

  test('503 when METRO_MONITOR_TOKEN is unset', async () => {
    const stateDir = freshStateDir(ctx);
    /** Explicitly clear the env var inside the child. */
    ctx.server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: '' });
    const r = await fetch(`${ctx.server.url}/api/state`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(r.status).toBe(503);
    const j = await r.json() as { error: string };
    expect(j.error).toContain('not configured');
  });
});

describe('GET /api/state', () => {
  test('200 with claims, lines, recent_history, bot_ids', async () => {
    const stateDir = freshStateDir(ctx);
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

    ctx.server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });
    const r = await fetch(`${ctx.server.url}/api/state`, {
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
    const stateDir = freshStateDir(ctx);
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
    ctx.server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });

    /** Page 2: skip 2 newest, return next 2 → msg_2, msg_1. */
    const r = await fetch(`${ctx.server.url}/api/state?before=2&limit=2`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(r.status).toBe(200);
    const body = await r.json() as { recent_history: Array<{ id: string }>; claims?: unknown };
    expect(body.recent_history.map(e => e.id)).toEqual(['msg_2', 'msg_1']);
    /** Pagination response is history-only — no claims/lines/bot_ids. */
    expect(body.claims).toBeUndefined();
  });

  test('?before past end returns empty page', async () => {
    const stateDir = freshStateDir(ctx);
    seedHistory(stateDir, [{
      id: 'msg_only', ts: '2026-05-17T00:00:00.000Z', kind: 'inbound', station: 'discord',
      line: 'metro://discord/1', from: 'metro://discord/user/x', to: 'metro://discord/1', text: 'x',
    }]);
    ctx.server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });
    const r = await fetch(`${ctx.server.url}/api/state?before=99&limit=20`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(r.status).toBe(200);
    const body = await r.json() as { recent_history: unknown[] };
    expect(body.recent_history).toEqual([]);
  });

  test('empty state — 200 with empty maps', async () => {
    const stateDir = freshStateDir(ctx);
    ctx.server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });
    const r = await fetch(`${ctx.server.url}/api/state`, {
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
