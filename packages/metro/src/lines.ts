/** URI helpers for `metro://<station>/<path>` lines + the runtime parsers stations share. */

import { asLine, type Line as LineBrand } from './types.js';

export type Line = LineBrand;
export { asLine };

const PREFIX = 'metro://';
const build = (station: string, ...seg: (string | number)[]): Line =>
  asLine(`${PREFIX}${station}/${seg.map(String).join('/')}`);

function parseLocalSession(line: Line | string, station: 'claude' | 'codex'): { userId: string; sessionId: string } | null {
  const p = Line.parse(line);
  if (p?.station !== station || p.path[0] === 'user' || p.path.length < 2) return null;
  return { userId: p.path[0], sessionId: p.path[1] };
}

/** Const + namespace — builders for each known station + a generic parser. */
export const Line = {
  discord: (channelId: string): Line => build('discord', channelId),
  telegram: (chatId: number | string, topicId?: number): Line =>
    topicId !== undefined ? build('telegram', chatId, topicId) : build('telegram', chatId),
  claude: (orgId: string, sessionId: string): Line => build('claude', orgId, sessionId),
  codex: (accountId: string, threadId: string): Line => build('codex', accountId, threadId),
  webhook: (endpointId: string): Line => build('webhook', endpointId),
  user: (station: string, id: string | number): Line => build(station, 'user', id),

  parse(line: Line | string): { station: string; path: string[] } | null {
    if (!line.startsWith(PREFIX)) return null;
    const rest = line.slice(PREFIX.length);
    const slash = rest.indexOf('/');
    if (slash <= 0) return null;
    const path = rest.slice(slash + 1).split('/').filter(Boolean);
    return path.length ? { station: rest.slice(0, slash), path } : null;
  },
  station: (line: Line | string): string | null => Line.parse(line)?.station ?? null,
  parseDiscord(line: Line | string): string | null {
    const p = Line.parse(line);
    return p?.station === 'discord' && p.path.length === 1 ? p.path[0] : null;
  },
  parseTelegram(line: Line | string): { chatId: number; topicId?: number } | null {
    const p = Line.parse(line);
    if (p?.station !== 'telegram') return null;
    const chatId = Number(p.path[0]);
    if (!Number.isFinite(chatId)) return null;
    if (p.path.length === 1) return { chatId };
    const topicId = Number(p.path[1]);
    return Number.isFinite(topicId) ? { chatId, topicId } : null;
  },
  parseClaude: (line: Line | string) => parseLocalSession(line, 'claude'),
  parseCodex: (line: Line | string) => parseLocalSession(line, 'codex'),
  parseWebhook(line: Line | string): string | null {
    const p = Line.parse(line);
    return p?.station === 'webhook' && p.path.length === 1 ? p.path[0] : null;
  },
  isLocal: (line: Line | string): boolean => {
    const s = Line.station(line);
    return s === 'claude' || s === 'codex';
  },
};
