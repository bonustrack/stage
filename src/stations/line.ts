/** Metro URI scheme: `metro://<station>/<path>`. See docs/uri-scheme.md. */

import { asLine, type Line } from './types.js';

export type Parsed = { station: string; path: string[] };

const PREFIX = 'metro://';

/** Parse any well-formed Line into `{ station, path }`. Returns null for malformed input. */
export function parse(line: Line | string): Parsed | null {
  if (!line.startsWith(PREFIX)) return null;
  const rest = line.slice(PREFIX.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  const station = rest.slice(0, slash);
  const path = rest.slice(slash + 1).split('/').filter(Boolean);
  return path.length ? { station, path } : null;
}

/** Extract just the station name. */
export const station = (line: Line | string): string | null => parse(line)?.station ?? null;

const build = (station: string, ...segments: (string | number)[]): Line =>
  asLine(`${PREFIX}${station}/${segments.map(String).join('/')}`);

export const claude = (threadId: string): Line => build('claude', threadId);
export const codex = (threadId: string): Line => build('codex', threadId);
export const discord = (channelId: string): Line => build('discord', channelId);
export const telegram = (chatId: number | string, topicId?: number): Line =>
  topicId !== undefined ? build('telegram', chatId, topicId) : build('telegram', chatId);
export const github = (owner: string, repo: string, isPR: boolean, number: number): Line =>
  build('github', owner, repo, isPR ? 'pull' : 'issues', number);

/** Parse a Discord line; returns the channel id or null. */
export const parseDiscord = (line: Line): string | null => {
  const p = parse(line); return p?.station === 'discord' && p.path.length === 1 ? p.path[0] : null;
};

/** Parse a Telegram line; returns `{ chatId, topicId? }` or null. */
export const parseTelegram = (line: Line): { chatId: number; topicId?: number } | null => {
  const p = parse(line); if (p?.station !== 'telegram') return null;
  const chatId = Number(p.path[0]); if (!Number.isFinite(chatId)) return null;
  if (p.path.length === 1) return { chatId };
  const topicId = Number(p.path[1]); if (!Number.isFinite(topicId)) return null;
  return { chatId, topicId };
};

/** Parse a GitHub line; returns `{ owner, repo, isPR, number }` or null. */
export const parseGithub = (line: Line): { owner: string; repo: string; isPR: boolean; number: number } | null => {
  const p = parse(line); if (p?.station !== 'github' || p.path.length !== 4) return null;
  const kind = p.path[2]; if (kind !== 'issues' && kind !== 'pull') return null;
  const number = Number(p.path[3]); if (!Number.isFinite(number)) return null;
  return { owner: p.path[0], repo: p.path[1], isPR: kind === 'pull', number };
};
