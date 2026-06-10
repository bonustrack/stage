/**
 * CLI-level tests for `metro outbox` (list) and `metro outbox retry <id>`.
 * Boots a mock IPC server on the process's own STATE_DIR socket (where ipcCall
 * connects) and drives the cmdOutbox handler in-process, asserting the wire ops
 * and rendered output.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { createServer, type Server } from 'node:net';
import { join } from 'node:path';
import { STATE_DIR } from '../src/paths.ts';
import { cmdOutbox } from '../src/cli/webhook.ts';
import type { OutboxEntry } from '../src/outbox.ts';

const SOCKET = join(STATE_DIR, 'metro.sock');

type Req = { op: string; state?: string; limit?: number; outboxId?: string };
let server: Server | null = null;
let seen: Req[] = [];

function startIpc(reply: (req: Req) => object): Promise<Server> {
  mkdirSync(STATE_DIR, { recursive: true });
  if (existsSync(SOCKET)) { try { unlinkSync(SOCKET); } catch { /* ignore */ } }
  return new Promise((resolve, reject) => {
    const srv = createServer({ allowHalfOpen: true }, sock => {
      let buf = '';
      sock.setEncoding('utf8');
      sock.on('data', chunk => {
        buf += chunk;
        const nl = buf.indexOf('\n');
        if (nl === -1) return;
        const req = JSON.parse(buf.slice(0, nl).trim()) as Req;
        seen.push(req);
        sock.write(JSON.stringify(reply(req)) + '\n');
        sock.end();
      });
    });
    srv.on('error', reject);
    srv.listen(SOCKET, () => resolve(srv));
  });
}

/** Capture process.stdout.write for the duration of `fn`. */
async function captureStdout(fn: () => Promise<void>): Promise<string> {
  const orig = process.stdout.write.bind(process.stdout);
  let out = '';
  (process.stdout.write as unknown) = (s: string | Uint8Array): boolean => { out += s.toString(); return true; };
  try { await fn(); } finally { (process.stdout.write as unknown) = orig; }
  return out;
}

const entry = (over: Partial<OutboxEntry> = {}): OutboxEntry => ({
  outboxId: 'out_1', idempotencyKey: 'idem_1', train: 'xmtp', action: 'send', args: {},
  state: 'dead', attempts: 3, ts: '2026-06-11T00:00:00.000Z', lastError: 'boom', ...over,
});

beforeEach(() => { seen = []; });
afterEach(async () => { if (server) { await new Promise<void>(r => server!.close(() => r())); server = null; } });

describe('metro outbox (CLI)', () => {
  test('list renders entries and passes the wire op', async () => {
    server = await startIpc(() => ({ ok: true, entries: [entry()] }));
    const out = await captureStdout(() => cmdOutbox(['list'], {}));
    expect(seen[0].op).toBe('outbox-list');
    expect(out).toContain('out_1');
    expect(out).toContain('dead');
    expect(out).toContain('xmtp/send');
  });

  test('--state and --limit are forwarded; --json emits the raw entries', async () => {
    server = await startIpc(() => ({ ok: true, entries: [entry({ state: 'dead' })] }));
    const out = await captureStdout(() => cmdOutbox(['list'], { state: 'dead', limit: '5', json: true }));
    expect(seen[0]).toMatchObject({ op: 'outbox-list', state: 'dead', limit: 5 });
    const j = JSON.parse(out) as { entries: OutboxEntry[] };
    expect(j.entries[0].outboxId).toBe('out_1');
  });

  test('bad --state is rejected before any IPC (exit code 1)', async () => {
    server = await startIpc(() => ({ ok: true, entries: [] }));
    let code: number | undefined;
    try { await cmdOutbox(['list'], { state: 'bogus' }); }
    catch (err) { code = (err as { code?: number }).code; }
    expect(code).toBe(1);
    expect(seen.length).toBe(0);
  });

  test('retry <id> sends the outbox-retry op', async () => {
    server = await startIpc(() => ({ ok: true }));
    await captureStdout(() => cmdOutbox(['retry', 'out_1'], { json: true }));
    expect(seen[0]).toMatchObject({ op: 'outbox-retry', outboxId: 'out_1' });
  });

  test('retry of an unknown id surfaces the daemon error (exit code 3)', async () => {
    server = await startIpc(() => ({ ok: false, error: "no outbox entry with id 'x'" }));
    let code: number | undefined;
    try { await cmdOutbox(['retry', 'x'], {}); }
    catch (err) { code = (err as { code?: number }).code; }
    expect(code).toBe(3);
  });
});
