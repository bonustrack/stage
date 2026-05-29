# Architecture

## System Shape

Metro has one core package, `@metro-labs/metro`, and several clients:

- `packages/metro` — daemon, CLI, dispatcher, broker, monitor API, train supervisor.
- `apps/app` — Expo mobile companion.
- `apps/ui` — Vue web companion.
- `packages/client` — framework-neutral client logic.
- `packages/kit` — framework-neutral UI tokens, icon data, and theme contracts.

The daemon is intentionally small. Platform behavior lives in train scripts under
`~/.metro/trains/`, outside the repo, so integrations can be rewritten without
changing core.

## Event Flow

1. `metro` starts the dispatcher.
2. The train supervisor spawns each `~/.metro/trains/*.{ts,js,mjs}` file with Bun.
3. Trains emit JSON lines to stdout.
4. The dispatcher normalizes each event, appends it to
   `$METRO_STATE_DIR/history.jsonl`, and writes it to stdout.
5. Subscribers read through `metro tail`, monitor SSE, or the Codex bridge.
6. Outbound calls use `metro call <train> <action> <args>` or
   `POST /api/call/<train>/<action>`, then the daemon forwards the call to the
   selected train over stdin.

Core knows the train protocol, not platform-specific actions.

## Event Envelope

Train wire fields are snake_case. History entries use camelCase. A typical event:

```json
{
  "id": "msg_...",
  "ts": "2026-05-17T18:00:00Z",
  "station": "discord",
  "line": "metro://discord/123",
  "from": "metro://discord/user/456",
  "to": "metro://claude/user/abc",
  "text": "hi",
  "messageId": "789",
  "payload": {}
}
```

Direction is derived from `from`, not a `kind` field.

## Routing Model

The broker is log-based:

- Events are appended once to `history.jsonl`.
- Claims live in `$METRO_STATE_DIR/claims.json`.
- Cursors live under `$METRO_STATE_DIR/cursors/`.
- `metro tail` applies claim and `to` filtering when reading.

Important routing rules:

- `event.to === self` always delivers to that `self`.
- `--strict` only delivers events claimed by `self` or addressed to `self`.
- Webhooks are excluded from personal modes unless `--include-webhooks` is set.
- XMTP account isolation is done through account owner routing:
  `tony -> metro://claude/user/...`, `codex -> metro://codex/user/...`.

See [Broker semantics](../packages/metro/docs/broker.md) for details.

## Monitor API

The daemon serves webhook and monitor routes on the same HTTP server, normally
`127.0.0.1:8420`.

Main routes:

- `GET /api/state`
- `GET /api/tail` (Server-Sent Events, claim-aware)
- `POST /api/call/<train>/<action>`

`/api/state` and `/api/tail` are read-only; `/api/call` is the single write path
and never touches `history.jsonl` directly — the train emits its own outbound
event, which flows back through the normal stream. All monitor routes require
`METRO_MONITOR_TOKEN` (constant-time bearer check; 503 when unset). See
[Monitor endpoints](../packages/metro/docs/monitor.md).

## Multi-Agent Model

One shared daemon serves every CLI; each loads its own routed feed:

- Claude Code owns one XMTP account (e.g. `tony`); Codex owns another (e.g. `codex`).
- Account ownership is declared by the `owner` URI in `~/.metro/xmtp-accounts.json`.
- Feed isolation is log-based: each reader's tail filter + the shared `claims.json`
  decide delivery. The default personal mode (`mine-or-unclaimed`) delivers lines
  claimed by self plus any unclaimed line; events addressed to `self` (`to === self`)
  always pass, and webhooks are excluded from personal feeds unless `--include-webhooks`.
  Claiming is explicit (`metro claim <line>`); there is no auto-claim on outbound.
- Each CLI should send only from its own account; the XMTP **send-guard**
  ([`src/cli/send-guard.ts`](../packages/metro/src/cli/send-guard.ts)) refuses a
  cross-account send when caller and account-owner stations conflict.

See [Multi-agent setup](./agents.md) for the full picture.
