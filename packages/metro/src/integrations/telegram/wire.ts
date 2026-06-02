/** Telegram train ↔ daemon wire helpers (stdout protocol framing). */

export const emit = (e: unknown): void => void process.stdout.write(JSON.stringify(e) + '\n');

export const respond = (id: string, body: { result?: unknown; error?: string }): void =>
  void process.stdout.write(JSON.stringify({ op: 'response', id, ...body }) + '\n');

export const mintId = (): string => `msg_${Math.random().toString(36).slice(2, 10)}`;

export const SELF_URI = process.env.METRO_SELF_URI ?? '';
