# Metro broker

Multi-user event routing on top of the event log. Turns "one daemon → one stdout consumer"
into "one daemon → N independently-subscribed users (Claude Code, Codex, anything) with
durable, replayable delivery".

## Core idea

One concept — a **claim** — and three on-disk files you can `cat`:

| Concern              | File                                    | Role                                                                                                              |
|----------------------|-----------------------------------------|-------------------------------------------------------------------------------------------------------------------|
| Event log            | `$METRO_STATE_DIR/history.jsonl`        | Append-only JSONL — every inbound/outbound/edit/react. Single source of truth.                                    |
| Claims               | `$METRO_STATE_DIR/claims.json`          | `{ <line>: <user-id> }` — flat map. A line in here is *exclusively* owned by that user. Absence = broadcast.      |
| Per-mode cursor      | `$METRO_STATE_DIR/cursors/<key>`        | Byte offset into `history.jsonl` — last-emitted position for one tail mode. Updated atomically after each emit.   |

Cursor keys are derived from the *effective mode* (not from `userSelf()`), so `--all` and
`--unclaimed` don't collide with a personal `--as=<id>` tail:

| Tail invocation                            | Cursor key                                                      |
|--------------------------------------------|-----------------------------------------------------------------|
| `metro tail --as=<id>`                     | `<userSlug(id)>`                                                |
| `metro tail --as=<id> --strict`            | `<userSlug(id)>--strict`                                        |
| `metro tail --as=<id> --include-webhooks`  | `<userSlug(id)>--with-webhooks` (or `…--strict--with-webhooks`) |
| `metro tail --unclaimed`                   | `_unclaimed`                                                    |
| `metro tail --all`                         | `_all`                                                          |

The `_` prefix on the mode-keys can't collide with a real `userSelf()` slug. `--chat=<line>`
and `--station=<name>` are post-filters applied **after** cursor advancement, so they don't
need their own cursor keys.

Subscribers do not register with the daemon. They tail the log; the broker semantics emerge
from one filtering rule applied at read time:

> An event is delivered to a user when its `line` is **claimed by that user** *or* **claimed by no one**.

That single rule covers every case the design needs to handle:

- **Chat with one responder** — user claims the chat; other tailing users stop receiving it. No race.
- **Webhook fan-out** — nobody claims; every user tailing a matching filter sees it.
- **Operator observability** — `metro tail` with no `--as` (or `--all`) shows everything regardless of claims; doesn't take ownership.
- **Sub-user onboarding** — sub-user claims its assigned chat before reading; parent stops receiving that chat without any coordination.

```
                                ┌──────────────────────────┐
   inbound (Discord/TG/web) ──► │  dispatcher              │ ──► history.jsonl  ◄── metro tail --as claude-A
                                │  (writes log, no routing)│                    ◄── metro tail --as codex-B
                                └──────────────────────────┘                    ◄── metro tail --as claude-sub-1
                                                                                       (each holds its own cursor)
```

## CLI surface

```bash
# Tail the event log. --follow streams new entries via fs.watch.
metro tail [--as <user-id>] [--follow] [--strict | --unclaimed | --all] [--include-webhooks]
           [--chat <line>] [--station <name>] [--since <offset|tail>] [--limit <n>]

# Claims: assert/release exclusive ownership of a line. Updates claims.json.
metro claim   <line> [--as <user-id>]      # add/overwrite — last writer wins
metro release <line>                       # remove (line returns to broadcast)
metro claims                               # print current claims.json
```

`--as <user-id>` defaults to `userSelf()` ([history.ts](../src/history.ts)) — the same stable
identity already used in routing-aware code.

### Subscription modes

The same `metro tail` command serves four distinct callers — a working user, a strict
subscriber, a router, and a human observer. Each maps to one mutually-exclusive flag:

| Mode               | Flag                       | Predicate                                                                       | Who uses it                                                |
|--------------------|----------------------------|---------------------------------------------------------------------------------|------------------------------------------------------------|
| **Mine + free**    | `--as <id>` (default)      | `(claims[line] == <id> ∨ line ∉ claims) ∧ station ≠ 'webhook'`                  | Default working user. Zero-config single-user setup.       |
| **Mine only**      | `--as <id> --strict`       | `claims[line] == <id> ∧ station ≠ 'webhook'`                                    | Disciplined subscriber that won't race on unclaimed events.|
| **Unclaimed only** | `--unclaimed`              | `line ∉ claims`                                                                 | Router/first-responder pattern that finds work to claim.   |
| **All**            | (no `--as`) or `--all`     | `true`                                                                          | Operator/auditor/debugger; never takes ownership.          |

Webhooks (`station == 'webhook'`) are excluded from the personal modes by default — they're
broadcast traffic (GitHub pushes, Intercom pings, etc.) that should flow to the *router*
(`--unclaimed`) or *operator* (`--all`) feed, not firehose into every `--as <id>` tail. Opt
back in with `metro tail --as <id> --include-webhooks`.

Direct messages between users (`event.to == user-line`) always pass the filter regardless of
mode — they're inherently 1:1 and can't be "claimed" by someone else.

### Auto-claim on outbound

Outbound paths call `tryAutoClaim` ([broker/claims.ts](../src/broker/claims.ts)) to claim the target `<line>`
for the actor (`userSelf()`) the first time it's touched, atomically — same lockfile as
`metro claim`. Auto-claim only fires when **the line topology is 1:1** (DM, or a
Claude/Codex cross-user line). Shared lines are skipped:

| Line                                            | Classification | Auto-claim? | How                                                          |
|-------------------------------------------------|----------------|-------------|--------------------------------------------------------------|
| `metro://telegram/<positive-id>` (incl. topics) | DM             | Yes         | Telegram chat-id > 0 ⇒ private chat                          |
| `metro://telegram/<negative-id>` / `-100…`      | group          | **No**      | Telegram chat-id < 0 ⇒ group/supergroup                      |
| `metro://discord/<channel-id>` (no guild)       | DM             | Yes         | Recent inbound payload `guildId == null`                     |
| `metro://discord/<channel-id>` (in guild)       | group          | **No**      | Recent inbound payload `guildId != null`                     |
| `metro://discord/<channel-id>` (no inbound)     | unknown        | Yes         | No metadata cached — treat as DM-eligible until proven group |
| `metro://claude/...` / `metro://codex/...`      | 1:1            | Yes         | Cross-user notify is inherently 1:1 by construction          |
| `metro://webhook/<id>`                          | broadcast      | **Never**   | Webhook lines are a stream, not a conversation               |

- If the line is already claimed by someone else (and topology check passed), the action
  still proceeds but the claim is **not overwritten**.
- Auto-claim writes happen after the action succeeds, so a failed call never writes to `claims.json`.

### `metro tail` mechanics

- Reads `history.jsonl`, applies the mode predicate + any `--chat`/`--station` filters (AND),
  prints one JSONL line per event to stdout.
- With `--follow`: stays open, watches the file via `fs.watch`, emits new matching lines.
- Maintains a per-mode cursor (byte offset) at `cursors/<key>`. On startup, resumes from cursor;
  on each emitted line, the offset is advanced *after* the write succeeds. O(1) resume.
- `--since <offset>` overrides the cursor; `--since=tail` starts from EOF, ignoring backlog.
- Claim lookups read `claims.json` once per emitted event. Small (~KB), OS-cached; sub-microsecond cost.

### `metro claim` semantics

- Pure metadata edit on `claims.json`. Does **not** notify the daemon — claims are read by
  tails, not the dispatcher.
- Re-claiming a line re-assigns it (last writer wins). `metro claims` prints the current map.
- Releasing a line returns it to broadcast — every matching tail picks it up again.
- Writes to `claims.json` are wrapped in an `O_EXCL` lockfile to serialize concurrent writes
  on the same host.

## Dispatcher

The dispatcher stays dumb. `emit()` appends to history, pushes to codex-rc, and writes to
stdout. All routing intelligence lives in `metro tail`'s filter, which reads two small files
(`claims.json` + its own cursor) per event. No new sockets, no fan-out bookkeeping, no
coupling between subscriber count and daemon state.

## Concurrency

Multiple processes write `history.jsonl`: the daemon's `emit()` and short-lived auto-claim
writers. `appendFileSync` opens with `O_APPEND`; POSIX guarantees atomic seek-to-end-and-write
per `write(2)`. Concurrent writers produce whole lines in some order, never interleaved halves.
Node issues one `write(2)` per `appendFileSync` call, and history entries stay well under
per-syscall atomicity limits (~2GB on Linux, `INT_MAX` on macOS).

`claims.json` is read on every event by every tail; writes are infrequent. An `O_EXCL`
lockfile around writes is enough; tails do an unlocked read with a malformed-JSON retry.

## Isolation

`METRO_STATE_DIR` isolates state-dir-scoped artifacts (`history.jsonl`, `claims.json`,
`cursors/`, `lines.json`, `bot-ids.json`, the daemon socket, the webhook port). It does **not**
isolate platform credentials — those are owned by the train and read from `~/.metro/.env`.

## Failure modes

| Failure                             | Behavior                                                                                          |
|-------------------------------------|---------------------------------------------------------------------------------------------------|
| Process crashes mid-event           | Cursor not advanced → event redelivered on next `metro tail`. At-least-once.                      |
| Two users claim same line           | `claims.json` last-write-wins. `metro claims` shows current owner; humans resolve.                |
| No user claims a chat               | Event broadcasts to every tail whose filters match.                                               |
| `history.jsonl` grows unboundedly   | Out of scope here. (Rotate by date, prune by age.)                                                |

## Non-goals

- **Strict ordering across chats**: events within one `line` are ordered by JSONL append order; cross-chat ordering is best-effort.
- **Exactly-once delivery**: at-least-once via cursor + redelivery. Idempotency is the subscriber's problem (the daemon mints stable `msg_*` ids).
- **Authn between users**: any process with filesystem access to `$METRO_STATE_DIR` can tail and claim. Same trust model as the host.
- **Remote users**: broker is local-only. Cross-host fan-out is solved by running metro on each host and bridging at the chat layer.
