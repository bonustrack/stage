# claude-station

Identifies the local Claude Code user; provides `notify` for cross-user
messaging through the running metro daemon.

## Configured when

`process.env.CLAUDECODE` is set (i.e. we are running inside a Claude Code
session). Reads the Anthropic org id via `claude auth status --json`.

## Lines

- `metro://claude/<orgId>/<sessionId>` — local session line.
- `metro://claude/user/<id>` — participant URI.

## Actions

| action  | args                            | returns                          |
|---------|---------------------------------|----------------------------------|
| `notify`| `{line, text, from?}` — re-emits as an inbound on the daemon's stream | `{ok: true}` |
| `whoami`| `{}`                            | `{accountId, userId} \| {error}` |

The `notify` action exists so a remote agent / CLI can deliver a message into
this user's Claude Code session via the metro daemon's stdout (Monitor reads
that). It does NOT call Claude Code's API directly.
