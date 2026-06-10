/** Line URI helpers. The whole metro:// vocabulary. */

export type Line = string & { readonly __line: unique symbol };
export const asLine = (s: string): Line => s as Line;

const PREFIX = 'metro://';
const build = (station: string, ...seg: (string | number)[]): Line =>
  asLine(`${PREFIX}${station}/${seg.map(String).join('/')}`);

/** Shared parser for `metro://{claude,codex}/<userId>/<sessionId>`. Skips the `/user/…` participant URI. */
function parseLocalSession(line: Line | string, station: 'claude' | 'codex'): { userId: string; sessionId: string } | null {
  const p = Line.parse(line);
  if (p?.station !== station || p.path[0] === 'user' || p.path.length < 2) return null;
  return { userId: p.path[0], sessionId: p.path[1] };
}

/** Canonical splitter for account-scoped station lines (xmtp, discord): */
/** `metro://<station>/<account>/<resource>` with legacy single-segment */
/** `metro://<station>/<resource>` → the `default` account. Two segments → new; */
/** one → legacy; anything else → null (matches the old anchored `^…/<a>/<b>$` / */
/** `^…/<b>$` regexes). `validate(resource)` lets discord require a snowflake. */
function parseAccountScoped(
  line: Line | string,
  station: string,
  validate?: (resource: string) => boolean,
): { accountId: string; resource: string } | null {
  const p = Line.parse(line);
  if (p?.station !== station) return null;
  let accountId: string, resource: string;
  if (p.path.length === 2) { accountId = p.path[0]; resource = p.path[1]; }
  else if (p.path.length === 1) { accountId = 'default'; resource = p.path[0]; }
  else return null;
  if (validate && !validate(resource)) return null;
  return { accountId, resource };
}

const isSnowflake = (s: string): boolean => /^\d+$/.test(s);

/** URI helpers. Lives on a const that doubles as the `Line` type's value-side namespace. */
export const Line = {
  discord: (channelId: string): Line => build('discord', channelId),
  telegram: (chatId: number | string, topicId?: number): Line =>
    topicId !== undefined ? build('telegram', chatId, topicId) : build('telegram', chatId),
  claude: (orgId: string, sessionId: string): Line => build('claude', orgId, sessionId),
  codex: (accountId: string, threadId: string): Line => build('codex', accountId, threadId),
  webhook: (endpointId: string): Line => build('webhook', endpointId),
  /** Participant URI — `metro://<station>/user/<id>`. */
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
  parseClaude: (line: Line | string) => parseLocalSession(line, 'claude'),
  parseCodex: (line: Line | string) => parseLocalSession(line, 'codex'),
  isLocal: (line: Line | string): boolean => {
    const s = Line.station(line);
    return s === 'claude' || s === 'codex';
  },

  /** Split an xmtp line → `{accountId, resource}` (resource = conv id). New */
  /** `metro://xmtp/<account>/<conv>`; legacy `metro://xmtp/<conv>` → `default`. */
  parseXmtp: (line: Line | string) => parseAccountScoped(line, 'xmtp'),

  /** Split a discord line → `{accountId, resource}` (resource = channel */
  /** snowflake). New `metro://discord/<account>/<chan>`; legacy → `default`. */
  parseDiscord: (line: Line | string) => parseAccountScoped(line, 'discord', isSnowflake),
};
