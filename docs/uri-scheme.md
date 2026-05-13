# Metro URI scheme

Universal identifier for every conversational scope and notification sink in metro. Lines pass around as opaque strings; only the owning station parses its own paths.

## Grammar

```
line       = "metro://" station "/" path
station    = lowercase identifier (claude | codex | discord | telegram | …)
path       = station-specific, "/"-separated segments
```

The URI parses cleanly with the WHATWG `URL` parser: `new URL(line)` gives `protocol="metro:"`, `host=<station>`, `pathname="/<path>"`.

## Registered stations

| Station    | Kind  | Pattern                                   | Example                               |
|------------|-------|-------------------------------------------|---------------------------------------|
| `discord`  | chat  | `metro://discord/<channel-id>`            | `metro://discord/1234567890123456789` |
| `telegram` | chat  | `metro://telegram/<chat-id>[/<topic-id>]` | `metro://telegram/-1001234567890/42`  |
| `claude`   | agent | `metro://claude/<topic>`                  | `metro://claude/deploys`              |
| `codex`    | agent | `metro://codex/<topic>`                   | `metro://codex/ci`                    |

## Participants

Every chat station also exposes participant URIs — used as `from` on inbound/outbound events and history rows.

| Kind  | Pattern                                  | Example                          |
|-------|------------------------------------------|----------------------------------|
| user  | `metro://<station>/user/<id>`            | `metro://discord/user/87654321`  |
| agent | `metro://{claude,codex}/<topic>`         | `metro://claude/agent`           |

`from` and `to` on history entries are always participant URIs. Discord/Telegram inbounds set `from` to the user URI; the daemon sets `to` to the agent identity (`metro://claude/agent` if `$CLAUDECODE` is detected, `metro://codex/agent` if `$METRO_CODEX_RC`/`$CODEX_HOME` is set, else `metro://agent`). On outbound, `from` = the same agent identity; `to` = the original sender for replies/reacts (looked up from history), or the channel `line` for fresh group sends. A `fromName` field carries the display name (`@alice`, `bonustrack_`).

Override with `--from=<uri>` on any write command, or set `$METRO_FROM` to pin a custom identity for the whole session.

Chat lines identify a Discord channel / Telegram chat (with optional forum topic). Agent lines are notification sinks — posting to one re-emits the message on the daemon's stdout stream and (if configured) pushes it to the Codex app-server. They have no inherent "messages"; only events.

## Message addressing

Messages on chat lines are referenced by **line + message id** (two args), not as part of the URI. So:

```bash
metro reply  metro://discord/123…  4567  "ack"
metro edit   metro://discord/123…  9876  "fixed typo"
metro react  metro://telegram/-100…/42  4567  👍
```

## Properties

- **Stable**: a Line is valid for the lifetime of the scope.
- **Self-describing**: the station name is encoded; the dispatcher routes by station prefix.
- **Persistable**: safe as a JSON key on disk (used by `lines.json`).
- **Branded**: TypeScript type `Line` prevents mixing with arbitrary strings.

## API

```ts
import { Line } from './stations/index.js';            // value namespace + type

const l: Line = Line.discord('1234567890');     // typed Line
Line.parse(l);                                   // { station: 'discord', path: ['1234567890'] } | null
Line.station(l);                                 // 'discord'
Line.isAgent(Line.claude('deploys'));            // true
```

## Adding a new station

1. Pick a lowercase station name (`slack`, `matrix`, …).
2. Add a `Line.<station>(...)` formatter and a parser that returns your typed payload.
3. Document the path grammar in the table above.
