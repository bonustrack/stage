/** Webhook endpoint registry: persists `(id, label, secret?)` for each receive endpoint. */

import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { STATE_DIR } from './paths.js';

const FILE = join(STATE_DIR, 'webhooks.json');

export type Endpoint = { id: string; label: string; secret?: string; createdAt: string };
type Store = { endpoints: Endpoint[] };

/** Local listener port — `127.0.0.1` only; expose publicly via Cloudflare tunnel. */
export const webhookPort = (): number => Number(process.env.METRO_WEBHOOK_PORT) || 8420;

function read(): Store {
  if (!existsSync(FILE)) return { endpoints: [] };
  try { return JSON.parse(readFileSync(FILE, 'utf8')) as Store; }
  catch { return { endpoints: [] }; }
}

function write(s: Store): void { writeFileSync(FILE, JSON.stringify(s, null, 2)); }

export const listEndpoints = (): Endpoint[] => read().endpoints;
export const findEndpoint = (id: string): Endpoint | undefined => read().endpoints.find(e => e.id === id);

export function addEndpoint(label: string, secret?: string): Endpoint {
  const s = read();
  /** 16-char URL-safe id (~96 bits — collision-proof for any reasonable count). */
  const ep: Endpoint = {
    id: randomBytes(12).toString('base64url'), label, createdAt: new Date().toISOString(),
    ...(secret ? { secret } : {}),
  };
  s.endpoints.push(ep);
  write(s);
  return ep;
}

export function removeEndpoint(id: string): boolean {
  const s = read();
  const before = s.endpoints.length;
  s.endpoints = s.endpoints.filter(e => e.id !== id);
  if (s.endpoints.length === before) return false;
  write(s);
  return true;
}
