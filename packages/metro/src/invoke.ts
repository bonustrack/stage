/** Single REST primitive for adapters. Auth + base URL per station, Telegram unwrap inline. */

const DISCORD_BASE = 'https://discord.com/api/v10';
const TELEGRAM_BASE = 'https://api.telegram.org';

function need(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} is not set`);
  return v;
}

/** `invoke(station, method, path, body?)` → parsed JSON (Buffer for non-JSON, undefined for 204). */
/** Discord = `https://discord.com/api/v10<path>` + `Bot` auth. Telegram = `…/bot<token><path>` (unwrapped). */
/** Webhook throws (receive-only). `body` may be a plain object (JSON) or `FormData` (multipart). */
export async function invoke(
  station: string, method: string, path: string, body?: unknown, timeoutMs = 30_000,
): Promise<unknown> {
  if (station === 'webhook') throw new Error('webhook is receive-only; no invoke()');
  if (station !== 'discord' && station !== 'telegram') {
    throw new Error(`unknown station '${station}' (discord|telegram only)`);
  }
  const url = station === 'discord'
    ? `${DISCORD_BASE}${path}`
    : `${TELEGRAM_BASE}/bot${need('TELEGRAM_BOT_TOKEN')}${path}`;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers: Record<string, string> = {
    'User-Agent': 'metro (https://github.com/bonustrack/metro)',
  };
  if (station === 'discord') headers.Authorization = `Bot ${need('DISCORD_BOT_TOKEN')}`;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${station} ${method} ${path}: ${res.status} ${text}`);
  }
  if (res.status === 204) return undefined;
  const ctype = res.headers.get('content-type') ?? '';
  if (!ctype.includes('application/json')) return Buffer.from(await res.arrayBuffer());
  const parsed: unknown = await res.json();
  /** Telegram wraps results in `{ok, result, description}` — unwrap so the adapter sees the bare value. */
  if (station === 'telegram' && parsed && typeof parsed === 'object' && 'ok' in parsed) {
    const env = parsed as { ok: boolean; description?: string; result?: unknown };
    if (!env.ok) throw new Error(`telegram ${path}: ${env.description ?? 'unknown error'}`);
    return env.result;
  }
  return parsed;
}
