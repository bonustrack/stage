# codex-station

Identifies the local Codex user; provides `notify` for cross-user messaging
through the running metro daemon.

## Configured when

`process.env.METRO_CODEX_RC` is set, or `process.env.CODEX_HOME` (or
`~/.codex/`) holds a logged-in `auth.json`.

The Codex push (WS `turn/start`) lives in the metro daemon (`codex-rc.ts`),
not in this station. The station only owns identity + cross-user notify.

## Lines

- `metro://codex/<accountId>/<threadId>` — local thread line.
- `metro://codex/user/<id>` — participant URI.

## Actions

| action  | args                            | returns                                       |
|---------|---------------------------------|-----------------------------------------------|
| `notify`| `{line, text, from?}` — re-emits as an inbound on the daemon's stream | `{ok: true}` |
| `whoami`| `{}`                            | `{accountId, userId, sessionId} \| {error}`   |
