/** Discord REST helpers — shared between gateway-side ops and CLI write paths. */

import { basename } from 'node:path';
import { log } from '../log.js';

const API_BASE = 'https://discord.com/api/v10';

const token = (): string => {
  const t = process.env.DISCORD_BOT_TOKEN;
  if (!t) throw new Error('DISCORD_BOT_TOKEN is not set');
  return t;
};

const headers = (extra: Record<string, string> = {}): Record<string, string> => ({
  'Authorization': `Bot ${token()}`,
  'User-Agent': 'metro (https://github.com/bonustrack/metro, dev)',
  ...extra,
});

export async function rest<T = unknown>(
  method: string, path: string, body?: unknown, timeoutMs = 30_000, retriesLeft = 2,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: headers(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status === 429 && retriesLeft > 0) {
    const retryAfter = Number(res.headers.get('retry-after')) || 1;
    log.debug({ path, retryAfter }, 'discord 429; backing off');
    await new Promise(r => setTimeout(r, Math.max(retryAfter * 1000, 250)));
    return rest<T>(method, path, body, timeoutMs, retriesLeft - 1);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`discord ${method} ${path}: ${res.status} ${text}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/** Multipart upload (payload_json + files[N]). Same retry semantics as `rest`. */
export async function restMultipart<T = unknown>(
  method: string, path: string, payload: unknown, files: { path: string; data: Buffer }[],
): Promise<T> {
  const form = new FormData();
  form.append('payload_json', JSON.stringify(payload));
  for (const [i, f] of files.entries()) {
    form.append(`files[${i}]`, new Blob([new Uint8Array(f.data)]), basename(f.path));
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method, headers: headers(), body: form, signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`discord ${method} ${path}: ${res.status} ${t}`);
  }
  return (await res.json()) as T;
}
