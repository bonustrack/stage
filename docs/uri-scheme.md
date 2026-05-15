# Metro URI scheme

Universal identifier for every conversational scope in metro. Lines pass around as opaque strings; only the owning station parses its own paths.

## Grammar

```
line       = "metro://" station "/" path
station    = lowercase identifier (claude | codex | discord | telegram | webhook | …)
path       = station-specific, "/"-separated segments
```

The URI parses cleanly with the WHATWG `URL` parser: `new URL(line)` gives `protocol="metro:"`, `host=<station>`, `pathname="/<path>"`.

## Registered stations

| Station    | Pattern                                      | Example                                                                |
|------------|----------------------------------------------|------------------------------------------------------------------------|
| `discord`  | `metro://discord/<channel-id>`               | `metro://discord/1234567890123456789`                                  |
| `telegram` | `metro://telegram/<chat-id>[/<topic-id>]`    | `metro://telegram/-1001234567890/42`                                   |
| `claude`   | `metro://claude/<user-id>/<session-id>`      | `metro://claude/9bfc7af0-…/50b00d11-…`                                 |
| `codex`    | `metro://codex/<user-id>/<session-id>`       | `metro://codex/8119ecb1-…/01997d4b-…`                                  |
| `webhook`  | `metro://webhook/<endpoint-id>`              | `metro://webhook/fwaCgTKJuLAjS2K0`                                     |

Claude / Codex lines mirror the `<root>/<sub>` structure of `metro://telegram/<chat-id>/<topic-id>`: `<user-id>` (the stable account id — same across devices) plays the role of `<chat-id>`, and `<session-id>` (one conversation) plays the role of `<topic-id>`. Both segments are derived per station (see [participants](#participants) below).

## Participants

Every chat station also exposes participant URIs — used as `from` on inbound/outbound events and history rows.

| Kind   | Pattern                          | Example                                                       |
|--------|----------------------------------|---------------------------------------------------------------|
| user    | `metro://<station>/user/<id>`    | `metro://discord/user/87654321`                               |
| claude  | `metro://claude/user/<orgId>`    | `metro://claude/user/9bfc7af0-2117-44c5-baf2-d22ba382d065`    |
| codex   | `metro://codex/user/<accountId>` | `metro://codex/user/8119ecb1-b05e-48db-aa80-434584439df9`     |
| webhook | `metro://webhook/<endpointId>`   | `metro://webhook/fwaCgTKJuLAjS2K0` (line + `from` are the same — no HTTP-side user identity) |

`from` and `to` on history entries are always participant URIs. Discord/Telegram inbounds set `from` to the user URI; the daemon sets `to` to the local user identity:

- **Claude Code** (`$CLAUDECODE` set) — `metro://claude/user/<orgId>`. `<orgId>` is the stable Anthropic-account UUID, resolved by shelling out to `claude auth status --json`.
- **Codex** (`$METRO_CODEX_RC` or `$CODEX_HOME` set) — `metro://codex/user/<accountId>`. `<accountId>` is the ChatGPT-account UUID, read from `$CODEX_HOME/auth.json` (default `~/.codex/auth.json`) at the `tokens.account_id` field. Requires `auth_mode=chatgpt`; API-key-only Codex sessions have no account id and metro will error.
- **Neither** — `to` is the generic `metro://user`.

Same account on any machine yields the same URI. Switching accounts via `claude auth login` / `codex login` flips the URI within ~5 s for the long-lived daemon (5 s TTL cache); one-shot CLI invocations re-resolve every run. On outbound, `from` = the same user identity; `to` = the original sender for replies/reacts (looked up from history), or the channel `line` for fresh group sends. A `fromName` field carries the display name (`@alice`, `bonustrack_`).

Override with `--from=<uri>` on any write command, or set `$METRO_FROM` to pin a custom identity for the whole session.

Chat lines identify a Discord channel / Telegram chat (with optional forum topic). Claude / Codex lines identify a *specific session* of a specific user (`<user-id>/<session-id>`) — posting to one re-emits the message on the daemon's stdout stream and (if configured) pushes it to the Codex app-server. They have no inherent "messages"; only events.

### Session derivation per station

| Station  | `<user-id>`                | `<session-id>`                                                  |
|----------|----------------------------|-----------------------------------------------------------------|
| `claude` | `orgId` from `claude auth status --json` | `$CLAUDE_CODE_SESSION_ID` (set by Claude Code; stable across `--resume`)|
| `codex`  | `tokens.account_id` from `$CODEX_HOME/auth.json` | codex-rc thread id from the JSON-RPC handshake (`thread/loaded/list` → `thread/start`) |

Override either segment with `METRO_USER_ID` / `METRO_USER_SESSION_ID` env vars.

### User registry

The daemon persists every `(station, user-id, session)` tuple it sees to `$METRO_STATE_DIR/user-registry.json`. `metro stations` prints the count of seen users and sessions per station. Run it to discover what's reachable rather than guessing topic names.

## Webhook station

Receive-only HTTP endpoint for third-party services (GitHub, Intercom, Fireflies, …). Each registered endpoint is one `metro://webhook/<endpoint-id>` line.

- **Register:** `metro webhook add <label> [--secret=<shared-secret>]` mints a 16-char endpoint id (96 bits of entropy, persisted to `$METRO_STATE_DIR/webhooks.json`) and prints the receiving URL. `metro webhook list` / `remove <id>` for the obvious.
- **Listener:** the dispatcher binds `127.0.0.1:8420` (override with `METRO_WEBHOOK_PORT`) when ≥1 endpoint is registered. Routes `POST /wh/<endpoint-id>` to an inbound event with `payload: { headers, body }` — `body` is parsed JSON when the request `Content-Type` is JSON, raw string otherwise. `GET /wh/<endpoint-id>` returns 200 (for provider ping checks).
- **Envelope:** `messageId` falls back to `X-GitHub-Delivery` / `X-Request-ID` / a generated UUID for idempotency tracking. `text` is synthesized from `X-GitHub-Event` / `X-Intercom-Topic` plus method + path for at-a-glance routing; consumers narrow on `payload.body` for full event details.
- **HMAC verification:** if `--secret` was set on `metro webhook add`, requests must include a matching `X-Hub-Signature-256: sha256=<hex>` (GitHub/Intercom format) — mismatches are rejected with 401 before reaching the stream.
- **Public reachability:** provided by a Cloudflare named tunnel — see [Tunneling](#tunneling) below. Without one, the listener stays loopback-only (useful for `curl` testing).

## Tunneling

Webhook providers need a public URL. Metro integrates with **Cloudflare named tunnels** (free, stable, account-scoped):

```bash
cloudflared tunnel login                                   # one-time OAuth (browser)
metro tunnel setup metro webhook.yourdomain.com            # creates the tunnel + DNS route
metro                                                      # daemon spawns `cloudflared tunnel run`
```

After setup, `metro webhook list` prints `https://webhook.yourdomain.com/wh/<id>` for each endpoint. The URL is stable across restarts (bound to the tunnel UUID in `~/.cloudflared/<uuid>.json`, not the cloudflared process). Tunnel config persists at `$METRO_STATE_DIR/tunnel.json`. Without setup, endpoints fall back to `http://127.0.0.1:8420/wh/<id>` (local-only, useful for curl testing).

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
Line.claude(orgId, sessionId);                   // metro://claude/<orgId>/<sessionId>
Line.codex(accountId, threadId);                 // metro://codex/<accountId>/<threadId>
Line.parseClaude(l);                             // { userId, sessionId } | null
Line.parseCodex(l);                              // { userId, sessionId } | null
Line.webhook(endpointId);                        // metro://webhook/<endpointId>
Line.parseWebhook(l);                            // string | null  (the endpoint id)
Line.user(station, id);                          // metro://<station>/user/<id>
Line.isLocal(l);                                 // true for any metro://{claude,codex}/...
```

## Adding a new station

1. Pick a lowercase station name (`slack`, `matrix`, …).
2. Add a `Line.<station>(...)` formatter and a parser that returns your typed payload.
3. Document the path grammar in the table above.
