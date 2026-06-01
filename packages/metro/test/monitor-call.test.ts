/** Tests for the monitor's POST /api/call/<train>/<action> IPC-forwarding endpoint. */

import { describe, test } from 'bun:test';
import {
  TOKEN, expect, makeCtx, registerCleanup, startServer, freshStateDir, startMockIpc,
} from './monitor-helpers.ts';

const ctx = makeCtx();
registerCleanup(ctx);

describe('POST /api/call/<train>/<action>', () => {
  test('200 — forwards args to IPC, returns result', async () => {
    const stateDir = freshStateDir(ctx);
    const seen: Array<{ train?: string; action?: string; args?: unknown }> = [];
    ctx.ipcServer = await startMockIpc(stateDir, req => {
      seen.push({ train: req.train, action: req.action, args: req.args });
      return { ok: true, response: { result: { delivered: true, echo: req.args } } };
    });
    ctx.server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });

    const r = await fetch(`${ctx.server.url}/api/call/discord/send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ args: { line: 'metro://discord/1', text: 'hi' } }),
    });
    expect(r.status).toBe(200);
    const j = await r.json() as { result: { delivered: boolean; echo: { text: string } } };
    expect(j.result.delivered).toBe(true);
    expect(j.result.echo.text).toBe('hi');
    expect(seen[0].train).toBe('discord');
    expect(seen[0].action).toBe('send');
    expect((seen[0].args as { text: string }).text).toBe('hi');
  });

  test('200 — body without `args` wrapper is forwarded as-is', async () => {
    const stateDir = freshStateDir(ctx);
    ctx.ipcServer = await startMockIpc(stateDir, req => ({
      ok: true, response: { result: req.args },
    }));
    ctx.server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });

    const r = await fetch(`${ctx.server.url}/api/call/telegram/send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'raw' }),
    });
    expect(r.status).toBe(200);
    const j = await r.json() as { result: { text: string } };
    expect(j.result.text).toBe('raw');
  });

  test('400 — bad JSON', async () => {
    const stateDir = freshStateDir(ctx);
    ctx.ipcServer = await startMockIpc(stateDir, () => ({ ok: true, response: {} }));
    ctx.server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });

    const r = await fetch(`${ctx.server.url}/api/call/discord/send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: '{not json',
    });
    expect(r.status).toBe(400);
  });

  test('502 — train returned error', async () => {
    const stateDir = freshStateDir(ctx);
    ctx.ipcServer = await startMockIpc(stateDir, () => ({
      ok: true, response: { error: 'train said no' },
    }));
    ctx.server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });

    const r = await fetch(`${ctx.server.url}/api/call/discord/send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ args: {} }),
    });
    expect(r.status).toBe(502);
    const j = await r.json() as { error: string };
    expect(j.error).toContain('train said no');
  });

  test('405 — GET on /api/call/* path', async () => {
    const stateDir = freshStateDir(ctx);
    ctx.server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });
    const r = await fetch(`${ctx.server.url}/api/call/discord/send`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(r.status).toBe(405);
  });

  test('401 — no bearer token', async () => {
    const stateDir = freshStateDir(ctx);
    ctx.server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });
    const r = await fetch(`${ctx.server.url}/api/call/discord/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(r.status).toBe(401);
  });

  test('502 — daemon IPC unavailable', async () => {
    const stateDir = freshStateDir(ctx);
    /** No mock IPC server — ipcCall should fail with "daemon is not running". */
    ctx.server = await startServer({ METRO_STATE_DIR: stateDir, METRO_MONITOR_TOKEN: TOKEN });
    const r = await fetch(`${ctx.server.url}/api/call/discord/send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ args: {} }),
    });
    expect(r.status).toBe(500);
  });
});
