/** Line URI scheme + ChatStation interface + station listing. The whole station surface. */

import { tryClaudeAccountId } from './claude.js';
import { tryCodexAccountId } from './codex.js';
import { listAgents } from '../registry.js';

export type Modality = 'text' | 'image';
export type Feature = 'reply' | 'send' | 'edit' | 'react' | 'download' | 'fetch' | 'notify';
export interface Capabilities { in: Modality[]; out: Modality[]; features: Feature[] }

export type Line = string & { readonly __line: unique symbol };
export const asLine = (s: string): Line => s as Line;

export interface InboundMessage<TPayload = unknown> {
  /** Universal metro ID (`msg_…`). Minted by the dispatcher on every inbound. */
  id: string;
  /** ISO timestamp from the platform (or `new Date().toISOString()` if unavailable). */
  ts: string;
  station: string;
  /** The conversation URI (channel / chat / topic). */
  line: Line;
  lineName?: string;
  /** Universal participant URI of the sender: `metro://<station>/user/<id>`. */
  from: Line;
  /** Display name (`@alice`, `bonustrack_`) — for humans. Optional. */
  fromName?: string;
  /** Universal participant URI of the recipient — the agent consuming metro. */
  to?: Line;
  /** Platform-side message id (Discord snowflake, Telegram int, etc.). */
  messageId: string;
  /** Universal display projection. Includes `[image]`/`[file: …]` tags inline. */
  text: string;
  /** Station-native message object. Shape is per-station; consumers narrow on `station`. */
  payload: TPayload;
}

export type Button = { text: string; url: string };
export type SendOpts = {
  replyTo?: string;
  images?: string[];      // 1+ photo file paths (album when >1)
  documents?: string[];   // 1+ file paths
  voice?: string;         // single voice/audio file
  buttons?: Button[][];
};
export type EditOpts = { buttons?: Button[][] };

export interface ChatStation<TMeta = Record<string, unknown>> {
  readonly name: string;
  readonly capabilities: Capabilities;
  start(): Promise<void>;
  stop(): Promise<void>;
  onMessage(handler: (m: InboundMessage<TMeta>) => void): void;
  send(line: Line, text: string, opts?: SendOpts): Promise<string>;
  edit(line: Line, messageId: string, text: string, opts?: EditOpts): Promise<void>;
  react(line: Line, messageId: string, emoji: string): Promise<void>;
  download(line: Line, messageId: string, outDir: string): Promise<{ path: string; mediaType: string }[]>;
  fetch(line: Line, limit: number): Promise<FetchedMessage[]>;
}

export type FetchedMessage = { messageId: string; author: string; text: string; timestamp: string };

const PREFIX = 'metro://';
const build = (station: string, ...seg: (string | number)[]): Line =>
  asLine(`${PREFIX}${station}/${seg.map(String).join('/')}`);

/** Shared parser for `metro://{claude,codex}/<agentId>/<sessionId>`. Skips participant URIs (`/user/…`, `/bot/…`). */
function parseAgent(line: Line | string, station: 'claude' | 'codex'): { agentId: string; sessionId: string } | null {
  const p = Line.parse(line);
  if (p?.station !== station || p.path[0] === 'user' || p.path[0] === 'bot' || p.path.length < 2) return null;
  return { agentId: p.path[0], sessionId: p.path[1] };
}

/** URI helpers. Lives on a const that doubles as the `Line` type's value-side namespace. */
export const Line = {
  discord: (channelId: string): Line => build('discord', channelId),
  telegram: (chatId: number | string, topicId?: number): Line =>
    topicId !== undefined ? build('telegram', chatId, topicId) : build('telegram', chatId),
  /** `metro://claude/<orgId>/<sessionId>` — orgId from `claude auth status`, session from `CLAUDE_CODE_SESSION_ID`. */
  claude: (orgId: string, sessionId: string): Line => build('claude', orgId, sessionId),
  /** `metro://codex/<accountId>/<threadId>` — accountId from auth.json, thread from codex-rc handshake. */
  codex: (accountId: string, threadId: string): Line => build('codex', accountId, threadId),
  /** Participant URIs — `metro://<station>/user/<id>` and `metro://<station>/bot/<id>`. */
  user: (station: string, id: string | number): Line => build(station, 'user', id),
  bot: (station: string, id: string | number): Line => build(station, 'bot', id),

  parse(line: Line | string): { station: string; path: string[] } | null {
    if (!line.startsWith(PREFIX)) return null;
    const rest = line.slice(PREFIX.length);
    const slash = rest.indexOf('/');
    if (slash <= 0) return null;
    const path = rest.slice(slash + 1).split('/').filter(Boolean);
    return path.length ? { station: rest.slice(0, slash), path } : null;
  },
  station: (line: Line | string): string | null => Line.parse(line)?.station ?? null,
  parseDiscord(line: Line): string | null {
    const p = Line.parse(line);
    return p?.station === 'discord' && p.path.length === 1 ? p.path[0] : null;
  },
  parseTelegram(line: Line): { chatId: number; topicId?: number } | null {
    const p = Line.parse(line);
    if (p?.station !== 'telegram') return null;
    const chatId = Number(p.path[0]);
    if (!Number.isFinite(chatId)) return null;
    if (p.path.length === 1) return { chatId };
    const topicId = Number(p.path[1]);
    return Number.isFinite(topicId) ? { chatId, topicId } : null;
  },
  parseClaude: (line: Line | string) => parseAgent(line, 'claude'),
  parseCodex: (line: Line | string) => parseAgent(line, 'codex'),
  isAgent: (line: Line | string): boolean => {
    const s = Line.station(line);
    return s === 'claude' || s === 'codex';
  },
};

/** `out: ['text']` + `send` reflects the IPC notify path (`metro send metro://<station>/...` re-emits on stdout). */
const AGENT_CAPS: Capabilities = { in: ['text'], out: ['text'], features: ['send', 'notify'] };
const CHAT_CAPS: Capabilities = {
  in: ['text', 'image'],
  out: ['text'],
  features: ['reply', 'send', 'edit', 'react', 'download', 'fetch'],
};

export type StationRow = {
  name: string;
  kind: 'agent' | 'chat';
  configured: boolean | null;
  detail: string;
  capabilities: Capabilities;
};

function seenSummary(station: 'claude' | 'codex'): string {
  const agents = listAgents(station);
  if (!agents.length) return '';
  const sessions = agents.reduce((n, a) => n + a.sessions.length, 0);
  return ` · seen ${agents.length} agent${agents.length === 1 ? '' : 's'}, ${sessions} session${sessions === 1 ? '' : 's'}`;
}

function claudeStationDetail(): string {
  const seen = seenSummary('claude');
  if (!process.env.CLAUDECODE) return `launch metro from inside a Claude Code session${seen}`;
  const orgId = tryClaudeAccountId();
  return `${orgId ? `account: ${orgId}` : 'logged out — run `claude auth login`'}${seen}`;
}

function codexStationDetail(): string {
  const rc = process.env.METRO_CODEX_RC;
  const accountId = tryCodexAccountId();
  const seen = seenSummary('codex');
  const parts = [
    accountId ? `account: ${accountId}` : (rc ? '(no Codex account — run `codex login`)' : null),
    rc ? `push → ${rc}` : (!accountId ? 'set METRO_CODEX_RC=ws://… to push' : null),
  ].filter(Boolean);
  return `${parts.join(' · ')}${seen}`;
}

export const listStations = (): StationRow[] => [
  {
    name: 'discord', kind: 'chat', capabilities: CHAT_CAPS,
    configured: !!process.env.DISCORD_BOT_TOKEN, detail: 'DISCORD_BOT_TOKEN',
  },
  {
    name: 'telegram', kind: 'chat', capabilities: CHAT_CAPS,
    configured: !!process.env.TELEGRAM_BOT_TOKEN, detail: 'TELEGRAM_BOT_TOKEN',
  },
  {
    name: 'claude', kind: 'agent', capabilities: AGENT_CAPS,
    configured: !!process.env.CLAUDECODE,
    detail: claudeStationDetail(),
  },
  {
    name: 'codex', kind: 'agent', capabilities: AGENT_CAPS,
    configured: !!(process.env.METRO_CODEX_RC || process.env.CODEX_HOME),
    detail: codexStationDetail(),
  },
];

export const fmtCapabilities = (c: Capabilities): string =>
  `in: ${c.in.join('+') || '–'} · out: ${c.out.join('+') || '–'} · features: ${c.features.join(', ') || '–'}`;
