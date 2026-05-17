/** Codex JSON-RPC over WS: endpoint parsing, socket open, message encode/decode. */

import { createConnection } from 'node:net';
import { WebSocket } from 'ws';

export type Endpoint = { kind: 'tcp'; url: string } | { kind: 'unix'; path: string };

/** Accept ws://, wss://, unix:///abs/path, or /abs/path (shorthand for unix). */
export function parseUrl(input: string): Endpoint {
  if (input.startsWith('ws://') || input.startsWith('wss://')) return { kind: 'tcp', url: input };
  if (input.startsWith('unix://')) return { kind: 'unix', path: input.replace(/^unix:\/+/, '/') };
  if (input.startsWith('/')) return { kind: 'unix', path: input };
  throw new Error(`unsupported METRO_CODEX_RC: ${input} (expected ws://, wss://, unix://, or abs path)`);
}

export function openSocket(endpoint: Endpoint): WebSocket {
  if (endpoint.kind === 'tcp') return new WebSocket(endpoint.url);
  return new WebSocket('ws://localhost/', {
    createConnection: () => createConnection({ path: endpoint.path }),
  });
}

export type RpcMessage = {
  id?: number; method?: string;
  params?: unknown; result?: unknown; error?: { message?: string };
};

export function encodeRpc(id: number, method: string, params: unknown): string {
  return JSON.stringify({ jsonrpc: '2.0', id, method, params });
}

/** Extract the active-thread state from a `thread/status/changed` params payload. */
/** Codex 0.130+: `status: {active}` ⇒ in-flight; any other shape ⇒ idle. */
export function isStatusActive(params: unknown, expectedThreadId: string | null): { match: boolean; active: boolean } {
  const p = params as { threadId?: string; status?: string | { active?: unknown } } | undefined;
  if (p?.threadId !== expectedThreadId) return { match: false, active: false };
  const active = typeof p.status === 'object' && p.status !== null && 'active' in p.status;
  return { match: true, active };
}

export function extractThreadStartedId(params: unknown): string | undefined {
  return (params as { thread?: { id: string } } | undefined)?.thread?.id;
}

export function buildTurnInput(line: string): Array<{ type: string; text: string; textElements: unknown[] }> {
  return [{ type: 'text', text: line, textElements: [] }];
}
