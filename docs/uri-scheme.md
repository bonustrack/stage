# Metro URI scheme

Universal identifier for every conversational scope in metro. Stations and the dispatcher pass `Line` URIs as opaque strings; only the owning station parses its own paths.

## Grammar

```
line       = "metro://" station "/" path
station    = lowercase identifier (claude | codex | discord | telegram | github | ...)
path       = station-specific, "/"-separated segments
```

The URI parses cleanly with the WHATWG `URL` parser: `new URL(line)` gives `protocol="metro:"`, `host=<station>`, `pathname="/<path>"`.

## Properties

- **Stable**: a Line is valid for the lifetime of the scope (a Discord channel, a Telegram topic, a GitHub issue, an agent thread).
- **Self-describing**: the station name is encoded; the dispatcher routes by station prefix.
- **Persistable**: safe as a JSON key on disk (used by `scopes.json`).
- **Branded**: TypeScript type `Line` prevents mixing with arbitrary strings.
- **Single-source**: each station owns its parse/format helpers — adding a new station extends the namespace without touching shared code.

## Registered stations

| Station    | Pattern                                       | Example                                          |
|------------|-----------------------------------------------|--------------------------------------------------|
| `claude`   | `metro://claude/<thread-uuid>`                | `metro://claude/01933f7a-12b4-7c01-9d3e-...`     |
| `codex`    | `metro://codex/<thread-id>`                   | `metro://codex/thread_01HXYZ...`                 |
| `discord`  | `metro://discord/<channel-id>`                | `metro://discord/1234567890123456789`            |
| `telegram` | `metro://telegram/<chat-id>[/<topic-id>]`     | `metro://telegram/-1001234567890/42`             |
| `github`   | `metro://github/<owner>/<repo>/<number>`      | `metro://github/bonustrack/metro/123`            |

Telegram's optional topic-id distinguishes a forum topic from the main chat; absence means main chat / DM.

## API

```ts
import type { Line } from './stations/types.js';
import * as Line from './stations/line.js';

const l = Line.discord('1234567890');           // typed Line, never a raw string
const parsed = Line.parse(l);                    // { station: 'discord', path: ['1234567890'] } | null
Line.station(l);                                 // 'discord'
```

## Adding a new station

1. Pick a lowercase station name (`slack`, `matrix`, …).
2. Add a `Line.<station>(...)` formatter and a parser that returns your typed payload.
3. Document the path grammar in the table above.

## Compatibility

Pre-1.0: the scheme is stable but **on-disk state from older builds is not migrated** — older `discord:ID` / `telegram:CHAT:TOPIC` keys in `scopes.json` are ignored on first run after upgrade.
