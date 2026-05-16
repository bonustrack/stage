# Metro broker

Multi-user event routing. Turns metro from "one daemon → one stdout consumer" into "one daemon → N independently-subscribed users (Claude Code, Codex, anything) with durable, replayable delivery".

## Why

Today the dispatcher writes every inbound event to **its own stdout**, which only the parent process (one Claude Code, monitoring the daemon via `Monitor`) can read. Consequences:

- **Throughput bottleneck**: bursts of inbound messages serialize behind whatever the single user is currently doing.
- **No real sub-users**: `Agent`-tool sub-users can call `metro send` (IPC works from anywhere), but they cannot *receive* events — they have no stdout subscription.
- **No multi-instance**: a second `claude` window or a separate `codex` process can't join in; the stream has one reader.
- **No durability**: a user crashes mid-conversation → events emitted during the gap are lost; on restart it starts deaf.

The fix is to treat metro as a tiny **durable message broker** over the event log that already exists ([history.ts](../src/history.ts), [user-registry.json](../src/registry.ts)).

## Core idea

One concept — a **claim** — and three on-disk files you can `cat`:

| Concern              | File                                    | Role                                                                                                                              |
|----------------------|-----------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| Event log            | `$METRO_STATE_DIR/history.jsonl`        | Append-only JSONL — every inbound/outbound/edit/react. Already exists. The single source of truth.                                |
| Claims               | `$METRO_STATE_DIR/claims.json`          | `{ <line>: <user-id> }` — flat map. A line in here is *exclusively* owned by that user. Absence = broadcast. New.                 |
| Per-mode cursor      | `$METRO_STATE_DIR/cursors/<key>`        | Byte offset into `history.jsonl` — last-emitted position for one tail mode. New. Updated atomically after each emit.              |

Cursor keys are derived from the *effective mode* (not from `userSelf()`), so `--all` and `--unclaimed` don't collide with a personal `--as=<id>` tail:

| Tail invocation                  | Cursor key                         |
|----------------------------------|------------------------------------|
| `metro tail --as=<id>`           | `<userSlug(id)>`                   |
| `metro tail --as=<id> --strict`  | `<userSlug(id)>--strict`           |
| `metro tail --as=<id> --include-webhooks` | `<userSlug(id)>--with-webhooks` (or `…--strict--with-webhooks`) |
| `metro tail --unclaimed`         | `_unclaimed`                       |
| `metro tail --all`               | `_all`                             |

The `_` prefix on the mode-keys can't collide with a real `userSelf()` slug (which always contains a station name like `claude-user-…`). Switching modes mid-stream keeps each cursor independent — a `tail --all` from a `CLAUDECODE=1` shell does **not** advance the personal `--as=<me>` cursor.

`--chat=<line>` and `--station=<name>` are post-filters applied **after** cursor advancement, so they don't need their own cursor keys.

Subscribers do not register with the daemon. They tail the log; the broker semantics emerge from one filtering rule applied at read time:

> An event is delivered to a user when its `line` is **claimed by that user** *or* **claimed by no one**.

That single rule covers every case the design needs to handle:

- **Chat with one responder** — user claims the chat; other tailing users stop receiving it. No race.
- **Webhook fan-out** — nobody claims; every user tailing a matching filter sees it.
- **Operator observability** — `metro tail` with no `--as` (or `--all`) shows everything regardless of claims; doesn't take ownership.
- **Sub-user onboarding** — sub-user claims its assigned chat before reading; parent stops receiving that chat without any coordination.

There is no separate concept for "subscription" or "fan-out mode" — claims and their absence cover both. The dispatcher writes; tails filter; claims gate exclusivity. Three primitives, one rule.

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

# Outbound actions auto-claim the line on first contact when topology is 1:1 (DM, claude/codex line).
# Group / public / webhook lines are skipped by default — pass --claim to force.
metro send  <line> <text>          [--no-claim] [--claim]
metro reply <line> <msg-id> <text> [--no-claim] [--claim]
metro edit  <line> <msg-id> <text> [--no-claim] [--claim]
metro react <line> <msg-id> <emoji> [--no-claim] [--claim]
# Or disable globally: METRO_NO_AUTO_CLAIM=1

# Lease/ack — optional, v2. When enabled, an event is "in flight" with the
# claimant; if no ack in N seconds the cursor isn't advanced and the next
# `metro tail` re-emits.
metro ack <event-id> --as <user-id>
```

`--as <user-id>` defaults to `userSelf()` ([history.ts:121](../src/history.ts#L121)) — the same stable identity already used in routing-aware code.

### Subscription modes

The same `metro tail` command serves four distinct callers — a working user, a strict worker, a router, and a human observer. Each maps to one mutually-exclusive flag controlling the claim-aware filter:

| Mode               | Flag                       | Predicate                                                                       | Who uses it                                                |
|--------------------|----------------------------|---------------------------------------------------------------------------------|------------------------------------------------------------|
| **Mine + free**     | `--as <id>` (default)      | `(claims[line] == <id> ∨ line ∉ claims) ∧ station ≠ 'webhook'`                  | Default working user. Zero-config single-user setup.       |
| **Mine only**       | `--as <id> --strict`        | `claims[line] == <id> ∧ station ≠ 'webhook'`                                    | Disciplined worker that won't race on unclaimed events.    |
| **Unclaimed only**  | `--unclaimed`              | `line ∉ claims`                                                                 | Router/first-responder user that finds work to claim.      |
| **All**             | (no `--as`) or `--all`     | `true`                                                                          | Operator/auditor/debugger; never takes ownership.          |

Webhooks (`station == 'webhook'`) are excluded from the personal modes by default — they're broadcast traffic (GitHub pushes, Intercom pings, etc.) that should flow to the *router* (`--unclaimed`) or *operator* (`--all`) feed, not firehose into every `--as <id>` tail. Opt back in with `metro tail --as <id> --include-webhooks` when you genuinely want a worker to see them.

Two UX defaults worth being explicit about:

1. **`--as <id>` with no mode flag = "mine + free".** Single-user setups (the common case) get zero-config metro: nothing claimed yet, so the only tail sees everything. Adding a second user means claiming first — surfaced in docs, not enforced by the daemon. `--strict` is the opt-in for setups that want stricter separation.
2. **No `--as` = "all".** Matches the unix `tail -f` mental model. Operators just want to read the log without registering an identity or accidentally taking ownership of anything.

`--unclaimed` is the genuinely new primitive: it enables a "router" user pattern where one process watches for ownerless events and either responds directly or claims and delegates. It works with or without `--as` — with `--as`, outbound replies are still attributed correctly.

Direct messages between users (`event.to == user-line`) always pass the filter regardless of mode — they're inherently 1:1 and can't be "claimed" by someone else.

### Auto-claim on outbound

`metro send`, `reply`, `edit`, and `react` claim the target `<line>` for the actor (`userSelf()`) the first time they touch it, atomically — same lockfile as `metro claim`. The intent: when a user picks up a conversation by replying, subsequent inbound events on that line route to them without any explicit `metro claim` call.

Auto-claim only fires when **the line topology is 1:1** (DM, or a Claude/Codex cross-user line). Shared lines — group chats, public channels, webhook streams — would lock out other workers, so they're skipped by default:

| Line                                            | Classification | Auto-claim default? | How                                                          |
|-------------------------------------------------|----------------|---------------------|--------------------------------------------------------------|
| `metro://telegram/<positive-id>` (incl. topics) | DM             | Yes                 | Telegram chat-id > 0 ⇒ private chat                          |
| `metro://telegram/<negative-id>` / `-100…`      | group          | **No**              | Telegram chat-id < 0 ⇒ group/supergroup                      |
| `metro://discord/<channel-id>` (no guild)       | DM             | Yes                 | Recent inbound payload `guildId == null`                     |
| `metro://discord/<channel-id>` (in guild)       | group          | **No**              | Recent inbound payload `guildId != null`                     |
| `metro://discord/<channel-id>` (no inbound)     | unknown        | Yes (conservative)  | No metadata cached — treat as DM-eligible until proven group |
| `metro://claude/...` / `metro://codex/...`      | 1:1            | Yes                 | Cross-user notify is inherently 1:1 by construction          |
| `metro://webhook/<id>`                          | broadcast      | **Never**           | Webhook lines are conceptually a stream, not a conversation  |

- If the line is already claimed by **someone else** (and topology check passed), the action still proceeds (sending doesn't require ownership) but the claim is **not overwritten**. A single-line stderr note (`auto-claim skipped: line owned by <other-id>`) signals the no-op.
- On a group-line skip you'll see `auto-claim skipped: <line> is a group/public line; pass --claim to take it explicitly` on stderr.
- Opt-out per command with `--no-claim`, or globally with the env var `METRO_NO_AUTO_CLAIM=1`.
- Opt-IN for groups: `--claim` forces auto-claim even on a group/public line (operator explicitly takes responsibility).
- Cross-user sends (`metro send metro://claude/... ...` from a different user) auto-claim the target line too — the sender is taking ownership of the conversation.

This default plus the webhook-exclusion above means: a webhook or a busy group channel flowing through the daemon won't auto-claim under any worker, so the router pattern (`--unclaimed`) can still see them.

### `metro tail` mechanics

- Reads `history.jsonl`, applies the mode predicate + any `--chat`/`--station` filters (AND), prints one JSONL line per event to stdout.
- With `--follow`: stays open, watches the file via `fs.watch`, emits new matching lines as they're appended.
- Maintains a per-user cursor (byte offset) at `cursors/<user-id>`. On startup, resumes from cursor; on each emitted line, the offset is advanced *after* the write succeeds. Byte offsets give O(1) resume — no file scan.
- `--since <offset>` overrides the cursor; `--since=tail` starts from EOF, ignoring backlog. Useful for fresh-start without losing the persisted cursor.
- Claim lookups read `claims.json` once per emitted event. The file is small (a few KB) and OS-cached; cost is sub-microsecond per event.

### `metro claim` semantics

- Pure metadata edit on `claims.json`. Does **not** notify the daemon — claims are read by tails, not the dispatcher (see "Dispatcher changes" below).
- Re-claiming a line re-assigns it (last writer wins). `metro claims` prints the current map so a human can audit.
- Releasing a line returns it to broadcast — every matching tail picks it up again.
- Writes to `claims.json` are wrapped in an `O_EXCL` lockfile to serialize concurrent `metro claim` invocations on the same host.

## Dispatcher changes

Almost none. `emit()` still appends to history, pushes to codex-rc, and writes to stdout. The broker model lives entirely on the read side — claims and cursors are consulted by `metro tail`, not by the dispatcher. The dispatcher doesn't need to know who's listening or who's claimed what.

This is the design's key simplification: **the daemon stays dumb**. It's still a single-writer to a JSONL file. All the routing intelligence is in `metro tail`'s filter, which reads two small files (`claims.json` and its own cursor) on each event.

No new sockets. No fan-out bookkeeping. No coupling between subscriber count and daemon state.

## What this enables

- **Sub-users that actually receive events**: `Agent` spawns a sub-user whose first action is `metro tail --as <its-id> --chat <line> --follow &` — it then `Monitor`s that background process and gets *only* its assigned chat's events.
- **Two manual Claude Code windows**: each runs `metro tail --as claude-A` / `claude-B`, claims disjoint chats. No coordination beyond `metro claim`.
- **Codex alongside Claude**: same model — `metro tail --as codex-1 --station telegram` etc. The codex-rc push becomes optional: a Codex worker can subscribe via `metro tail` directly and bypass the rc file.
- **Crash recovery**: process dies → restarts → `metro tail` resumes from cursor → backlog replays in order. No double-replies (the cursor is advanced on emit, not on reply).
- **Replay for new joiners**: `metro tail --as new-user --since <offset-from-5-min-ago>` lets a freshly-spawned process backfill recent history before going live.

## Concurrency

Multiple processes already write `history.jsonl` today: the daemon's `emit()` and every short-lived CLI invocation (`metro send`/`reply`/`react` — see [actions.ts](../src/cli/actions.ts)). It works because `appendFileSync` opens with `O_APPEND`, and POSIX guarantees that `O_APPEND` writes atomically seek-to-end-and-write in one operation — concurrent writers produce whole lines in some order, never interleaved halves. Node issues one `write(2)` per `appendFileSync` call, and our entries (even fat webhook payloads) stay well under per-syscall atomicity limits on both Linux (~2GB) and macOS (`INT_MAX`). The broker model adds **only readers**, so the existing safety property is preserved.

`claims.json` is read on every event by every tail, but writes are infrequent (`metro claim`/`release`). An `O_EXCL` lockfile around writes is enough; tails do an unlocked read with a malformed-JSON retry (one read can race with one write; the retry resolves it).

## Isolation

`METRO_STATE_DIR` isolates state-dir-scoped artifacts (`history.jsonl`, `claims.json`, `cursors/`, `lines.json`, `bot-ids.json`, the daemon socket, the webhook port). It does **not** isolate platform credentials: `metro send`, `reply`, `edit`, and `react` always read bot tokens from `$XDG_CONFIG_HOME/metro/.env` (defaulting to `~/.config/metro/.env`) and post directly to Discord/Telegram regardless of where `METRO_STATE_DIR` points.

This means a test invocation with `METRO_STATE_DIR=/tmp/metro-test metro send …` will hit the **production** Discord/Telegram bot with production tokens. To avoid leaking real messages from a test/sandbox:

- Use lines whose channel/chat IDs you know don't exist (the platform will 4xx before any side-effect).
- Or unset/move `~/.config/metro/.env` for the test process — `metro send` will fail fast with a missing-token error.
- Or use `metro tail` + manual `history.jsonl` seeding to exercise the read path without any platform contact.

The auto-claim write happens **after** platform-API success, so a failed `metro send` never writes to `claims.json`. (Tests can rely on this: a failing send leaves the test state dir unchanged apart from the `history.jsonl` line the daemon would emit, if one were running.)

## Failure modes & guardrails

| Failure                             | Behavior                                                                                          |
|-------------------------------------|---------------------------------------------------------------------------------------------------|
| Process crashes mid-event           | Cursor not advanced → event redelivered on next `metro tail`. At-least-once.                      |
| Two users claim same line           | `claims.json` last-write-wins. `metro claims` shows current owner; humans resolve.                |
| No user claims a chat               | Event broadcasts to every tail whose filters match. Two tails without filters → both reply (operator error — claim should have been set first). |
| User silently slow (no ack)         | v1: not detected. v2: `metro ack` + lease TTL — cursor doesn't advance, next `metro tail` re-emits, can surface "X went dark on chat Y" via an inbound event from another user. |
| `history.jsonl` grows unboundedly   | Existing concern; out of scope for this doc. (Rotate by date, prune by age.)                      |

## Migration

All changes are additive. With no subscribers, the dispatcher behaves exactly as today (parent reads stdout, single-user throughput, no routing). The broker model layers on top:

1. Ship `metro tail` (read-only, no daemon changes, no claim file). Users can subscribe and filter; multi-cast works for everything.
2. Ship `metro claim`/`release`/`claims` + claim-aware filtering in `metro tail`. Exclusivity works.
3. Optional v2: lease/ack — only if silent drops become a real problem.

Each step is independently shippable.

## Open questions

- **Routing-key granularity**: claims map to `user-id` (orgId-level — same across sessions/devices) rather than `user-line` (`<user-id>/<session-id>`). This means two Claude Code windows logged into the same account share claims. The session-scoped alternative is more flexible but requires the claimant to write its current `selfLine()` into `claims.json` and refresh it when the session changes. **Default: user-id.** Override per-claim with `metro claim <line> --as <full-line>` if needed.
- **codex-rc deprecation**: today the dispatcher mirrors every event into a codex-rc file so Codex sees them. Once `metro tail` exists, Codex workers could subscribe directly. The rc-push stays for compatibility; the next major version can drop it.

## Non-goals

- **Strict ordering across chats**: events within one `line` are ordered by JSONL append order; cross-chat ordering is best-effort. Subscribers shouldn't rely on it.
- **Exactly-once delivery**: at-least-once via cursor + redelivery. Idempotency is the subscriber's problem (the daemon already mints stable `msg_*` ids).
- **Authn between users**: any process with filesystem access to `$METRO_STATE_DIR` can tail and claim. Same trust model as today.
- **Remote users**: broker is local-only. Cross-host fan-out is a separate problem (likely solved by running metro on each host and bridging at the chat layer).
