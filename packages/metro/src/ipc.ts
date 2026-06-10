/** Unix-socket IPC: `notify` re-emits a cross-user message, `forward-call` reaches a train's */
/** stdin and awaits its response, `trains-list` snapshots supervisor state. */

import { createConnection, createServer, type Server, type Socket } from 'node:net';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { errMsg, log } from './log.js';
import { STATE_DIR } from './paths.js';
import type { TrainCallResponse } from './trains/protocol.js';
import type { TrainInfo } from './trains/supervisor.js';
import type { OutboxEntry, OutboxState } from './outbox.js';

const SOCKET_PATH = join(STATE_DIR, 'metro.sock');

export type IpcRequest =
  | { op: 'notify'; line: string; from?: string; text: string }
  /** `idempotencyKey` is optional + additive: minted CLI-side per logical send and
   *  threaded into the outbox journal so a daemon restart can't double-dispatch. */
  | { op: 'forward-call'; train: string; action: string; args: unknown; idempotencyKey?: string }
  | { op: 'trains-list' }
  | { op: 'train-restart'; name: string }
  /** Read-only liveness probe: the running daemon reports its package version so */
  /** `metro doctor` can flag a restart-pending mismatch vs the installed code. */
  | { op: 'version' }
  | { op: 'outbox-list'; state?: OutboxState; limit?: number }
  | { op: 'outbox-retry'; outboxId: string };

export type IpcResponse =
  | { ok: true }
  | { ok: true; response: TrainCallResponse }
  | { ok: true; trains: TrainInfo[] }
  | { ok: true; version: string }
  | { ok: true; entries: OutboxEntry[] }
  | { ok: false; error: string };

type Handler = (req: IpcRequest) => Promise<IpcResponse> | IpcResponse;

export function startIpcServer(handler: Handler): Server {
  if (existsSync(SOCKET_PATH)) { try { unlinkSync(SOCKET_PATH); } catch { /* ignore */ } }
  /** allowHalfOpen: any `await` in the handler races Node's auto-end-on-client-FIN, dropping the response. */
  const server = createServer({ allowHalfOpen: true }, s => handleConnection(s, handler));
  server.on('error', err => log.warn({ err: errMsg(err) }, 'ipc server error'));
  server.listen(SOCKET_PATH, () => log.debug({ path: SOCKET_PATH }, 'ipc socket listening'));
  return server;
}

export async function stopIpcServer(server: Server): Promise<void> {
  await new Promise<void>(resolve => server.close(() => resolve()));
  try { if (existsSync(SOCKET_PATH)) unlinkSync(SOCKET_PATH); } catch { /* ignore */ }
}

async function handleConnection(socket: Socket, handler: Handler): Promise<void> {
  /** Newline-delimited request/response. Avoids races between `end()` writes and FIN under Bun. */
  let buf = '';
  socket.setEncoding('utf8');
  socket.on('data', async chunk => {
    buf += chunk;
    const nl = buf.indexOf('\n');
    if (nl === -1) return;
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    let resp: IpcResponse;
    try {
      const req = JSON.parse(line) as IpcRequest;
      resp = await handler(req);
    } catch (err) { resp = { ok: false, error: errMsg(err) }; }
    socket.write(JSON.stringify(resp) + '\n');
    socket.end();
  });
  socket.on('error', err => log.debug({ err: errMsg(err) }, 'ipc connection error'));
}

/** CLI-side: send one request, get one response. Throws if the daemon isn't running. */
export function ipcCall(req: IpcRequest, timeoutMs = 60_000): Promise<IpcResponse> {
  return new Promise((resolve, reject) => {
    if (!existsSync(SOCKET_PATH)) {
      reject(new Error('metro daemon is not running (start it with `metro`)'));
      return;
    }
    const socket = createConnection({ path: SOCKET_PATH });
    let buf = '';
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`ipc timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    socket.on('connect', () => { socket.write(JSON.stringify(req) + '\n'); });
    socket.on('data', chunk => {
      buf += chunk.toString('utf8');
      const nl = buf.indexOf('\n');
      if (nl === -1) return;
      clearTimeout(timer);
      const line = buf.slice(0, nl).trim();
      socket.end();
      try { resolve(JSON.parse(line) as IpcResponse); }
      catch (err) { reject(new Error(`ipc bad response: ${errMsg(err)}`)); }
    });
    socket.on('end', () => {
      clearTimeout(timer);
      if (!buf) reject(new Error('ipc connection closed without response'));
    });
    socket.on('error', err => { clearTimeout(timer); reject(err); });
  });
}
