/** Unix-socket IPC: `notify` re-emits a cross-user message, `forward-call` reaches a train's */
/** stdin and awaits its response, `trains-list` snapshots supervisor state. */

import { createConnection, createServer, type Server, type Socket } from 'node:net';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { errMsg, log } from './log.js';
import { STATE_DIR } from './paths.js';
import type { TrainCallResponse, TrainInfo } from './trains.js';

const SOCKET_PATH = join(STATE_DIR, 'metro.sock');

export type IpcRequest =
  | { op: 'notify'; line: string; from?: string; text: string }
  | { op: 'forward-call'; train: string; action: string; args: unknown }
  | { op: 'trains-list' };

export type IpcResponse =
  | { ok: true }
  | { ok: true; response: TrainCallResponse }
  | { ok: true; trains: TrainInfo[] }
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
  let buf = '';
  socket.setEncoding('utf8');
  socket.on('data', chunk => { buf += chunk; });
  socket.on('end', async () => {
    let resp: IpcResponse;
    try {
      const req = JSON.parse(buf.trim()) as IpcRequest;
      resp = await handler(req);
    } catch (err) { resp = { ok: false, error: errMsg(err) }; }
    socket.end(JSON.stringify(resp) + '\n');
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
    socket.on('connect', () => { socket.end(JSON.stringify(req)); });
    socket.on('data', chunk => { buf += chunk.toString('utf8'); });
    socket.on('end', () => {
      clearTimeout(timer);
      try { resolve(JSON.parse(buf.trim()) as IpcResponse); }
      catch (err) { reject(new Error(`ipc bad response: ${errMsg(err)}`)); }
    });
    socket.on('error', err => { clearTimeout(timer); reject(err); });
  });
}
