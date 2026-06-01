/**
 * Shared harness for the monitor HTTP endpoint tests (monitor-*.test.ts).
 *
 * Each test runs the monitor in a fresh subprocess so `METRO_STATE_DIR` resolves
 * cleanly (broker + monitor capture STATE_DIR at import time). `makeCtx()` returns
 * a per-file lifecycle holder; call `registerCleanup(ctx)` once per test file.
 */

import { afterEach, expect } from 'bun:test';
import { mkdtempSync, rmSync, appendFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createServer as createNetServer, type Server as NetServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const HARNESS = fileURLToPath(new URL('./monitor-harness.mjs', import.meta.url));

export const TOKEN = 'test-token-abc';
export type Server = { child: ChildProcessWithoutNullStreams; url: string };

export type Ctx = {
  tempRoots: string[];
  server: Server | null;
  ipcServer: NetServer | null;
};

export function makeCtx(): Ctx {
  return { tempRoots: [], server: null, ipcServer: null };
}

export async function startServer(env: Record<string, string>): Promise<Server> {
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

export function stopServer(s: Server): Promise<void> {
  return new Promise(resolve => {
    if (s.child.exitCode !== null) return resolve();
    s.child.once('exit', () => resolve());
    s.child.kill('SIGTERM');
    setTimeout(() => { try { s.child.kill('SIGKILL'); } catch { /* ignore */ } }, 1_000);
  });
}

export function freshStateDir(ctx: Ctx): string {
  const d = mkdtempSync(join(tmpdir(), 'metro-mon-test-'));
  ctx.tempRoots.push(d);
  return d;
}

export function seedHistory(stateDir: string, entries: object[]): void {
  mkdirSync(stateDir, { recursive: true });
  appendFileSync(join(stateDir, 'history.jsonl'), entries.map(e => JSON.stringify(e)).join('\n') + '\n');
}

export function seedClaims(stateDir: string, claims: Record<string, string>): void {
  writeFileSync(join(stateDir, 'claims.json'), JSON.stringify(claims, null, 2));
}

export function seedBotIds(stateDir: string, botIds: Record<string, string>): void {
  writeFileSync(join(stateDir, 'bot-ids.json'), JSON.stringify(botIds, null, 2));
}

/** Mock daemon IPC: listens on STATE_DIR/metro.sock and replies to forward-call. */
export function startMockIpc(
  stateDir: string,
  reply: (req: { op: string; train?: string; action?: string; args?: unknown }) => object,
): Promise<NetServer> {
  const path = join(stateDir, 'metro.sock');
  return new Promise((resolve, reject) => {
    const srv = createNetServer({ allowHalfOpen: true }, sock => {
      let buf = '';
      sock.setEncoding('utf8');
      sock.on('data', chunk => {
        buf += chunk;
        const nl = buf.indexOf('\n');
        if (nl === -1) return;
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        try {
          const req = JSON.parse(line);
          sock.write(JSON.stringify(reply(req)) + '\n');
        } catch (err) {
          sock.write(JSON.stringify({ ok: false, error: String(err) }) + '\n');
        }
        sock.end();
      });
    });
    srv.on('error', reject);
    srv.listen(path, () => resolve(srv));
  });
}

/** Install the per-file afterEach: tear down server/ipc and purge temp dirs. */
export function registerCleanup(ctx: Ctx): void {
  afterEach(async () => {
    if (ctx.server) { await stopServer(ctx.server); ctx.server = null; }
    if (ctx.ipcServer) {
      const s = ctx.ipcServer;
      await new Promise<void>(r => s.close(() => r()));
      ctx.ipcServer = null;
    }
    for (const d of ctx.tempRoots.splice(0)) {
      try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });
}

export { expect };
