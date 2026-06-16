# Stage CLI Architecture

Final architecture, transit-themed naming, and pros/cons for the unified Stage
CLI. Command-by-command reference lives in
[metro-cli-reference.md](./metro-cli-reference.md).

## 1. Executive Summary

Stage becomes a single noun-verb-target CLI
(`metro <noun> <verb> <target> [--flags]`) modeled on `gh` and `stripe`. It
serves two riders from one command set:

- Less on mobile: concise 1-3 line human text.
- The orchestrator and sub-agents: a stable `{ok,command,result|error}` JSON
  envelope.

The substance is ONE in-daemon Verb Registry. Each station verb declares
`{name, kind:read|mutate, inputSchema, description, example, idempotent}`, and
that single declaration renders the CLI dispatcher, `metro schema` / `metro
verbs`, the send-guard's mutation list, and (optionally, later) a thin MCP
adapter. This kills today's 3-way line-parse / schema / idempotency drift.

There is exactly ONE shared daemon (the network) owning the trains and a single
merged event stream. Sessions are logical bindings in `~/.metro/sessions.json`
(0600) mapping a session to one account per station with a derived owner
`metro://session/<id>`.

Accounts follow the MetaMask model. Existing `tony` (raw key) and `codex`
(derive) stay byte-for-byte untouched; new agents derive off a 0600 mnemonic;
raw-key import coexists and is tagged. Adding one is an honest "write config +
~few-second `metro train restart xmtp`".

Output is human-by-default (never auto-JSON on a pipe), `--json` for the
envelope, `-q` for id-only, with deterministic exit-code classes (7 =
rate-limited so scripts back off to Telegram).

## 2. Transit-Themed Naming

Stage already speaks transit: a **station** is a platform integration, a
**train** is the per-platform process, a **line** is a conversation
`metro://` URI. The scheme below extends that vocabulary where it sharpens the
mental model, and stays deliberately plain where theming would hurt agent
clarity.

Guiding rule: theme the CONCEPT names and the docs, but keep the actual CLI
command tokens obvious (`metro send`, `metro tail`). An agent reading
`metro schema` should never have to decode a metaphor to know what a verb does.
Themed aliases are offered only where they read naturally and never replace the
plain token.

| Concept | Themed name | Actual CLI token | Notes |
| --- | --- | --- | --- |
| Platform integration | station | `--station <name>` | existing vocab, kept |
| Per-platform process | train | `metro train ...` | existing vocab, kept |
| Conversation URI | line | `<line>` positional | existing vocab, kept |
| Shared daemon / process owning trains | the network (Stage Core) | `metro daemon ...` | "network" in prose; CLI token stays `daemon` for muscle memory |
| Account / identity (wallet+creds) | pass (a rider's fare pass) | `metro account ...`, `-a/--account` | "pass" in docs; token stays `account` to match the mobile app's mental model |
| Logical binding of accounts per station | trip | `metro session ...`, `--session` | a trip rides several lines under one identity set; token stays `session` |
| Owner identity of a trip | rider | derived `metro://session/<id>` | the rider who owns the trip |
| Agent (composed wallet+xmtp+session) | rider | `metro agent ...` | an autonomous rider on the network |
| Sending a message | send (board a message) | `metro send` | keep plain; no alias |
| Tail / streaming events | board (the arrivals board) | `metro tail` | "the board" in prose; token stays `tail`. Optional alias `metro board` -> `tail` |
| History of a line | log | `metro history` | keep plain |
| Channels / groups / DMs | lines (group line / direct line) | `metro channel|group|dm` | sub-kinds of line |
| The verb registry | the timetable | (internal) `metro schema` / `metro verbs` | every verb is a scheduled service on the timetable |
| A single verb | service | `<verb>` | a service that runs on a station |
| Idempotency key | ticket | `--idempotency-key` | one ticket = one ride, re-presenting it does not re-charge |
| Claiming a line for a session | claim | `metro claim` / `metro release` | keep plain |
| Health / status surface | station status | `metro station status`, `metro doctor` | keep plain |

What we deliberately did NOT theme: `send`, `reply`, `react`, `edit`, `delete`,
`tail`, `history`, `schema`, `verbs`, `call`, `doctor`. These are the
high-frequency agent verbs; an agent's task-completion depends on them reading
literally. The metaphor lives in the concept layer (prose, help text,
`whoami` output) and in two optional aliases (`metro board`, the "network"
phrasing), not in the load-bearing tokens.

## 3. Architecture

THREE LAYERS, ONE CORE. Builds on today's train-supervisor; additive, not a
daemon rewrite.

```
  Less (mobile)            Orchestrator + sub-agents         External agent
       |                          |                              |  (later)
   human text                 --json envelope                 MCP tools
       |                          |                              |
       +-----------+--------------+                              |
                   v                                             v
            +----------- CLI (thin client) -----------+   +-- metro mcp serve --+
            | argv -> verb input -> envelope/exit     |   | one tool per verb   |
            +-----------------------------------------+   +----------+----------+
                   | HTTP/IPC                                        |
                   v                                                 v
   ============ ONE SHARED DAEMON / THE NETWORK (single event log) ============
   |                                                                          |
   |  VERB REGISTRY / TIMETABLE (single source of truth)                      |
   |   {name, station|core, kind:read|mutate, inputSchema, desc, example,     |
   |    idempotent}  --> CLI dispatch | schema/verbs | send-guard | MCP       |
   |                                                                          |
   |  ONE typed Line parser (lines.ts: metro://<station>/<acct?>/<path...>)   |
   |    imported by xmtp/accounts.ts AND send-guard.ts (ends 3-way drift)     |
   |                                                                          |
   |  send-guard (off sessions.json, all stations, fail-open)                 |
   |  idempotency dedupe store (ticket -> result, TTL, 0600)                  |
   |  Supervisor: spawns trains as Bun subprocesses, multiplexes NDJSON       |
   |    stdout into ONE board, routes outbound to a train's stdin.            |
   ============================================================================
        |                 |                 |                 |
     xmtp train       discord train     telegram train    webhook/notify (core)
```

State on disk (all under `~/.metro`, dir 0700):

- `xmtp-accounts.json` / `discord-accounts.json` / `telegram-accounts.json`
  (0600) - pure credential stores: `{id, derive:<n>}` OR
  `{id, privateKey:"0x.."}`. Existing tony/codex entries untouched.
- `sessions.json` (0600, NO secrets) - the binding layer:
  `session -> {xmtp:<acctId>, discord:<acctId>, telegram:<acctId>,
  default:<acctId>}`; owner DERIVED as `metro://session/<id>`. Per-account
  `owner` survives only as the absent-sessions.json fallback.
- `xmtp-mnemonic` (0600, never overwritten; `XMTP_MNEMONIC` env wins) - HD seed
  for derived agents.
- accountId -> inboxId map (persisted from `bootAccount`) so rotating a wallet
  key does not change routing.
- idempotency dedupe store (0600, TTL-pruned).

Identity model: existing accounts kept as-is on their current
keys/inboxes/addresses, NO migration. New derived agents use the corrected
BIP-44 account axis and record their index in sessions.json; tony/codex stay on
the legacy axis (a small permanent inconsistency, the price of non-disruptive).
Raw import is tagged "imported" and explicitly excluded from the
mnemonic-backup guarantee (a MetaMask-style warning).

Sessions (trips) are logical bindings over the single event stream. Feed
isolation reuses today's `passesMode` `event.to === self` short-circuit plus a
per-session cursor; the dispatcher already fans out to a second session
(codex), so N-session fan-out just generalizes that (deferred, optional).

MCP (optional, later): a separate `metro mcp serve` wraps the SAME registry,
one tool per mutate verb with the registry's JSON-Schema, reads on demand, a
`metro_schema` discovery tool rather than a fat eager dump. It is the governed
outer-loop surface (auth + audit + scoping) for off-box/multi-tenant agents.
Less's own sub-agents stay on the CLI (inner loop: faster, lower-token, model
already fluent).

## 4. Pros and Cons of This Approach

The chosen approach: a single in-daemon Verb Registry feeding CLI + schema +
send-guard + optional MCP; one shared daemon with logical sessions;
MetaMask-style accounts; human-default output with `--json`.

### Pros

- **Kills 3-way drift.** Line parsing, arg schemas, and the
  mutation/idempotency list all derive from one registry + one typed parser.
  Today these live in three places and silently diverge; the registry makes
  divergence impossible by construction.
- **Agent-friendly by design.** Stable `ok` discriminant, stable string
  `error.code`, deterministic exit codes (7 -> back off to Telegram), full
  untruncated NDJSON, `--idempotency-key` dedupe, `--dry-run`, never
  interactive. This directly retires the documented double-send and
  missed-15-task-list loss classes.
- **Additive, not a rewrite.** Every change layers on the existing
  train-supervisor, trains-as-symlinks, and the `to===self` feed short-circuit.
  Each PR is independently shippable; first deploy breaks nothing.
- **One place to add behavior.** Register a verb and it auto-surfaces in the
  CLI, in `verbs`/`schema`, in the send-guard mutation set, and in MCP. No
  wiring four files, no doc/code drift.
- **Two riders, one surface.** Less (human text) and agents (`--json`) share
  the exact same commands, so the two modes can never diverge in behavior, only
  in rendering.
- **Non-disruptive identity.** tony/codex keep their exact keys, inboxes, and
  addresses. No migration, no risk to live routing.
- **Optional governed outer loop.** The same registry can later back an MCP
  adapter for off-box/multi-tenant agents without re-implementing anything.

### Cons and Risks

- **Registry abstraction overhead.** A verb registry plus per-call JSON-Schema
  validation adds indirection and a small latency cost on every call, and is
  more machinery to learn than scattered handlers. Worth it only because the
  drift it removes is expensive; for a tiny CLI it would be over-engineering.
- **Shared-daemon blast radius.** One process owning all trains means a daemon
  crash takes down every station at once, and a bad frame or memory leak in one
  train can degrade the whole board. Mitigated by per-train subprocesses and
  fail-open guards, but the single event log is a single point of failure.
- **Permanent legacy/new HD-axis inconsistency.** tony/codex stay on the legacy
  BIP-44 axis forever while new agents use the corrected axis. This is a
  deliberate, documented wart; anyone auditing derivation indices must know two
  rules apply.
- **Restart-on-add, not zero-downtime.** Adding an account requires a
  ~few-second `metro train restart xmtp`. Honest, but not the seamless
  hot-add some would expect; the in-daemon N-session fan-out that would remove
  it is deferred (PR11).
- **MCP deferred.** The governed/audited surface for external agents does not
  exist yet. Until a real external consumer appears, multi-tenant access has no
  first-class story beyond the CLI.
- **Theming-vs-clarity tension.** The transit metaphor is genuinely helpful in
  prose but actively harmful if pushed onto verb tokens. We hold the line at
  concept-only theming plus two aliases, which means the docs and the CLI use
  slightly different words for the same thing (network vs daemon, board vs
  tail, pass vs account). That is an intentional cost paid for agent clarity.

## 5. Migration from Today

KEPT AS-IS (no change, no migration):

- tony (raw key) and codex (derive) entries in `xmtp-accounts.json` - same
  keys, inboxes, addresses. The corrected BIP-44 axis applies ONLY to
  newly-derived agents.
- The train-supervisor daemon, trains-as-symlinks, builtin webhook/notify
  sources, the `passesMode to===self` feed-isolation short-circuit, per-session
  cursor files.
- The env fallback (`XMTP_PRIVATE_KEY` -> account `default`) and legacy
  single-segment `metro://xmtp/<conv>` (now maps to the configured default
  account, not a hardcoded string).

ADDITIVE (new surface, nothing removed):

- `sessions.json` binding layer (owner derived); per-account `owner` kept as
  the absent-sessions.json fallback so first deploy breaks nothing.
- `metro account|agent|session|whoami|channel|group|dm|schema|verbs|doctor`
  nouns; `metro mcp serve` (later).
- Idempotency store, dedupe on mutations.
- accountId -> inboxId routing alias.
- `tail --cursor` (with `--since` kept as a deprecation-warning alias on tail),
  `history --since`.

CLEAN BREAK (with a transitional deprecation shim where cheap):

- Drop `@file` path-reading in `messaging.ts:resolveText` and
  `webhook.ts:readArgs`, and drop bare-arg JSON-guess in `readArgs`. Replace
  with explicit `--text`/stdin for bodies and `--args-json|--args-file
  |--args-stdin` for `metro call`. Bare positional is always a literal. A
  one-release deprecation warning softens it.
- Uniform success envelope: fix call sites that wrote a bare result
  (`messaging.ts` `writeJson(result)`, history) to nest under
  `{ok,command,result}`.

## 6. Phased Implementation Plan

One writer on served-main; no concurrent clobber. Each PR is independently
shippable and version-neutral (never bumps `packages/metro/package.json`).

- **PR1 - Typed Line parser.** One parser in `lines.ts` modeling
  `metro://<station>/<acct?>/<path...>`; have `xmtp/accounts.ts:parseLine` and
  `send-guard.ts:targetAccount` import it. Pure refactor. Ends 3-way drift.
- **PR2 - Perms + account read surface.** Enforce 0600 on every
  accounts/sessions write + mkdir `~/.metro` 0700; `metro account list` and
  `metro account import` (stdin only, tagged, refuses argv secret).
- **PR3 - Sessions read-path + whoami.** `sessions.json` reader + `metro
  session list|owner`, `metro whoami`. Owner derived; per-account `owner` as
  fallback.
- **PR4 - Account/agent creation (NO migration).** `metro account new` (derive
  next free index, new agents only), `metro account derive --index`, `metro
  agent new`, mnemonic init at 0600. Add-then-restart model with the printed
  hint and `--restart`.
- **PR5 - Per-account outbound `from` behind a flag.** Route outbound by the
  resolved account/session. accountId -> inboxId alias persisted from
  `bootAccount`.
- **PR6 - Verb Registry + promoted verbs + output contract + clean parsing.**
  Introduce the registry; generate `schema`/`verbs`; promote channel/group/dm
  verbs; centralize `emitOk`/error helpers; DROP `@file`/auto-JSON, add
  `--args-json|--args-file|--args-stdin` and `--text`/stdin. Stable error.code
  strings + full exit-code table.
- **PR7 - Generalize send-guard.** Drive off sessions.json for all stations;
  resolve caller from `METRO_SESSION` (loud env-sniff fallback); reject only
  caller-session != owning-session; keep fail-open default.
- **PR8 - Idempotency + webhook owner/session.** Dedupe store (ticket->result,
  TTL, 0600) on send/react/edit; attach webhook events to a session owner.
- **PR9 - Discovery/health hardening.** `metro doctor` (perms + precedence +
  symlink-target + `*.bak` manifest), `metro station status` (rate-limit budget
  warning), `--cursor`/`--since` split + resumable SSE, FULL-text NDJSON
  guarantee.
- **PR10 - Discord NDJSON reader rename** (`line` frame var collision);
  stations stop dying to stderr on a bad frame.
- **PR11 (optional) - In-daemon N-session fan-out** (generalize the existing
  codex fan-out) to remove the restart, and `metro mcp serve` thin adapter over
  the registry. Deferred until a real need.

All PRs branch off main (not served-main), squash-merged by Less, never bump
`packages/metro/package.json`.
