# Metro monitor endpoints

Read-only HTTP endpoints for an external observer (the `apps/app` mobile app, an admin
dashboard, a curl one-liner) to view live daemon state without touching the JSONL files
directly.

These endpoints mount on the **existing** webhook HTTP server (default port `8420`).
There is no separate daemon, no separate port, no extra process to launch. The
implementation lives in [`src/cli/monitor-api.ts`](../src/cli/monitor-api.ts) (re-exported
by `src/cli/tail.ts` for backwards compatibility) and is wired into the HTTP server in
[`src/dispatcher/server.ts`](../src/dispatcher/server.ts) via `handleMonitorRequest`.

## Routes

| Method | Path                            | Returns                                                                                  |
|--------|---------------------------------|------------------------------------------------------------------------------------------|
| GET    | `/api/state`                    | JSON snapshot — `{ claims, lines, recent_history (last 100), bot_ids }`.                 |
| GET    | `/api/tail`                     | Server-Sent Events stream — `history.jsonl` entries, claim-aware filtered.                |
| POST   | `/api/call/<train>/<action>`    | Forward an action call to a train via `forward-call` IPC; returns `{result}`.            |
| POST   | `/api/messenger/send`           | In-daemon chat: emits a history entry on `metro://messenger/owner`. Accepts `{text?, attachments?[], as?}`. |
| POST   | `/api/messenger/register`       | Store an Expo push token so agent replies push to the phone.                              |
| POST   | `/api/messenger/upload`         | Raw binary upload (up to 25 MiB). Body = file bytes; headers `Content-Type`, optional `X-Filename`. Returns `{id, url, kind, mime, size, name?}`. |
| GET    | `/api/messenger/files/<name>`   | Stream a previously uploaded attachment. Accepts `?token=…` as an alternative to the bearer header for `<img>` / `<audio>` tags. |

`/api/state` and `/api/tail` are read-only. `/api/call/<train>/<action>` is the single
write endpoint — it never touches the on-disk history; the train running on the daemon
emits its own outbound event after delivering the message, which then flows through the
normal SSE stream like any other entry.

## Authentication

Bearer token in env: `METRO_MONITOR_TOKEN`.

- If unset, both routes respond **503** with `{"error":"monitor endpoints not configured (METRO_MONITOR_TOKEN unset)"}`. Anonymous access is never allowed by accident.
- If set, requests **must** carry `Authorization: Bearer <token>`. Missing/wrong/malformed → **401**. The comparison is constant-time (`crypto.timingSafeEqual`).

Set in `~/.config/metro/.env`:

```
METRO_MONITOR_TOKEN=<a long random string — `openssl rand -base64 32`>
```

The daemon picks up the env var on next start.

## `GET /api/state`

Returns a one-shot JSON snapshot:

```jsonc
{
  "claims": {
    "metro://discord/123456789": "metro://claude/user/abc"
  },
  "lines": [
    "metro://discord/123456789",
    "metro://telegram/-100…"
  ],
  "recent_history": [/* most-recent-first, up to 100 HistoryEntry objects */],
  "bot_ids": { "discord": "1234567890", "telegram": "987654321" },
  "version": "x.y.z"
}
```

- `claims` — verbatim contents of `claims.json`.
- `lines` — the set of conversation URIs seen across recent history and current claims (good-enough proxy for "what lines exist right now"). Subject to refinement; not authoritative.
- `recent_history` — same shape as `HistoryEntry` in `src/history.ts`, ordered most-recent-first, capped at 100 entries.
- `bot_ids` — verbatim contents of `bot-ids.json`.
- `version` — the daemon's package version (handy for clients gating on capabilities).

### Pagination

For backlog scrolling, pass `?before=<N>&limit=<M>` (both non-negative integers, `limit` clamped to 500):

```bash
curl -H "Authorization: Bearer $METRO_MONITOR_TOKEN" \
  "https://monitor.metro.box/api/state?before=200&limit=100" | jq .recent_history
```

When `before` is set, only `recent_history` is returned (the older slice). Without
`before`, the full snapshot above is returned.

### Example

```bash
curl -H "Authorization: Bearer $METRO_MONITOR_TOKEN" \
  https://monitor.metro.box/api/state | jq
```

## `GET /api/tail` (SSE)

Server-Sent Events stream of new `history.jsonl` entries. Each event has:

```
id: <metro-msg-id>
event: history
data: <one HistoryEntry as JSON>

```

The stream stays open until the client disconnects. A `: keepalive` comment is emitted
every 25 seconds to keep proxies happy.

### Query parameters

All optional. Mirror the `metro tail` CLI flags.

| Param              | Default     | Effect                                                                  |
|--------------------|-------------|-------------------------------------------------------------------------|
| `as=<line>`        | (none)      | Self URI — enables "mine + free" claim-aware filtering.                  |
| `mode=strict\|unclaimed\|all` | derived | Override the mode (`strict` needs `as=`).                            |
| `chat=<line>`      | (none)      | Only emit events matching this exact `line`.                            |
| `station=<name>`   | (none)      | Only emit events matching this station (`discord`, `telegram`, …).      |
| `include_webhooks=true` | `false`  | Include webhook-station events in personal modes.                       |
| `since=tail\|0\|<offset>` | `tail` | Where to start in `history.jsonl`. `tail` = EOF; `0` = full replay; or a byte offset. |

### Filter rule

Same predicate as `metro tail --as=<id> [--strict|--unclaimed|--all] [--include-webhooks]`:

> An event is delivered when its `line` is **claimed by `as=`** *or* **claimed by no one**,
> minus webhooks (unless `include_webhooks=true`), minus anything failing `chat=`/`station=`.

See [broker.md](./broker.md) for the underlying broker semantics.

### Example: live tail for a claude user

```bash
curl -N \
  -H "Authorization: Bearer $METRO_MONITOR_TOKEN" \
  "https://monitor.metro.box/api/tail?as=metro://claude/user/abc&include_webhooks=true"
```

The `-N` flag disables curl's output buffering so SSE frames appear as they arrive.

### Example: full backlog replay for debugging

```bash
curl -N \
  -H "Authorization: Bearer $METRO_MONITOR_TOKEN" \
  "https://monitor.metro.box/api/tail?since=0"
```

## `POST /api/call/<train>/<action>`

Forwards an action call to a train (same as `metro call <train> <action> <args>` on the
command line) via the daemon's existing `forward-call` IPC. Use this from the mobile or
web app to send a message, react, edit, etc. without needing shell access.

### Request

```http
POST /api/call/discord/send HTTP/1.1
Host: monitor.metro.box
Authorization: Bearer <METRO_MONITOR_TOKEN>
Content-Type: application/json

{"args": {"line": "metro://discord/123", "text": "hello from the web"}}
```

The body is one of:

- `{"args": <object|array|string>}` — explicit `args` wrapper (recommended).
- `<object>` — any other JSON object is forwarded as the args verbatim (useful for terse
  clients).
- Empty body — forwarded as `{}`.

`<train>` must match a train running under `~/.metro/trains/`; `<action>` is whatever
that train expects (`send`, `react`, `edit`, …).

### Response

| Status | Body                                                | Meaning                                                  |
|--------|-----------------------------------------------------|----------------------------------------------------------|
| 200    | `{"result": <whatever the train returned>}`         | Train accepted the call and returned a result.           |
| 400    | `{"error": "bad JSON body: …"}`                      | Body was not valid JSON.                                 |
| 401    | `{"error": "unauthorized"}`                          | Missing / wrong bearer token.                            |
| 405    | `{"error": "method not allowed"}`                    | Wrong verb (only `POST` is accepted on this path).       |
| 500    | `{"error": "…"}`                                     | Daemon IPC unavailable (e.g. socket missing).            |
| 502    | `{"error": "…"}`                                     | Train returned an error or the IPC handshake malformed.  |

Request bodies larger than 256 KiB are rejected with HTTP 500.

### Example: send a message

```bash
curl -X POST \
  -H "Authorization: Bearer $METRO_MONITOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"args":{"line":"metro://discord/123","text":"hi"}}' \
  https://monitor.metro.box/api/call/discord/send
```

Because the daemon's `send` adapter writes a history entry once the message lands, an
active `/api/tail` subscriber will receive the corresponding event a moment later
(`from` = local user). UIs typically clear the input on HTTP 200 and let the SSE replay
show the sent message.

## Exposing publicly via Cloudflare tunnel

The daemon listens on `127.0.0.1:8420` only. To reach `/api/*` from a phone or a
remote machine, route a public hostname through the existing `webhook.metro.box`
cloudflared tunnel.

Add a second hostname route to your `cloudflared` config (typically
`~/.cloudflared/config.yml`):

```yaml
ingress:
  - hostname: webhook.metro.box
    service: http://127.0.0.1:8420
  - hostname: monitor.metro.box     # new — same backing service
    service: http://127.0.0.1:8420
  - service: http_status:404
```

Then create the DNS record:

```bash
cloudflared tunnel route dns <tunnel-name> monitor.metro.box
```

Restart the tunnel; both hostnames now reach the same metro daemon. `webhook.metro.box`
keeps serving inbound webhooks; `monitor.metro.box` serves the bearer-token-gated
monitor routes.

There's no harm in serving `/api/*` from `webhook.metro.box` too — the bearer-token
gate is the same either way. The separate hostname is purely a routing convenience
(and lets you put different access policies in front of each, e.g., Cloudflare Access
on `monitor.metro.box` only).

## Failure modes

| Condition                          | Response                                                          |
|------------------------------------|-------------------------------------------------------------------|
| `METRO_MONITOR_TOKEN` not set      | 503 `{"error":"monitor endpoints not configured (...)"}`         |
| Missing `Authorization` header     | 401 `{"error":"unauthorized"}`                                    |
| Wrong / malformed token            | 401 `{"error":"unauthorized"}`                                    |
| Unknown `/api/*` path              | 404 `{"error":"not found"}`                                       |
| `POST` (or any non-`GET`) to `/api/*` | 405 `{"error":"method not allowed"}`                            |
| `history.jsonl` doesn't exist yet  | 200 with empty `recent_history` / SSE stream w/ no events.       |
| Client disconnects mid-SSE         | Handler clears its interval + closes the file watcher cleanly.   |
