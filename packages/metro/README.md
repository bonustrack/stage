# @metro-labs/metro

> Event-interception wire: supervise train subprocesses, multiplex their JSON event streams, and route outbound actions back in.

[![lines of code](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.codetabs.com%2Fv1%2Floc%2F%3Fgithub%3Dbonustrack%2Fstage&query=%24%5B%3F(%40.language%3D%3D%27Total%27)%5D.linesOfCode&label=lines%20of%20code&color=blue)](https://github.com/bonustrack/stage)

`metro` is the core of the [Metro](https://github.com/bonustrack/stage) monorepo: a small, pure-transport daemon and CLI. This README is the canonical reference for the wire and its CLI. The agent-facing playbook lives in [`skills/metro/SKILL.md`](skills/metro/SKILL.md); the URI scheme is specified in [`docs/uri-scheme.md`](docs/uri-scheme.md); the broker and monitor internals in [`docs/broker.md`](docs/broker.md) and [`docs/monitor.md`](docs/monitor.md); the higher-level CLI architecture in [`../../docs/metro-cli-architecture.md`](../../docs/metro-cli-architecture.md).

## Table of contents

- [What Metro is](#what-metro-is)
- [Install and first run](#install-and-first-run)
- [The Line scheme](#the-line-scheme)
- [The event envelope](#the-event-envelope)
- [CLI surface](#cli-surface)
  - [Messaging verbs](#messaging-verbs)
  - [Themed porcelain verbs](#themed-porcelain-verbs)
  - [Identity verbs](#identity-verbs)
  - [Daemon and feed verbs](#daemon-and-feed-verbs)
  - [`metro call` and the action reference](#metro-call-and-the-action-reference)
  - [Global flags, JSON envelope, exit codes](#global-flags-json-envelope-exit-codes)
- [Multi-account](#multi-account)
- [Sessions](#sessions)
- [The verb registry](#the-verb-registry)
- [The send-guard](#the-send-guard)
- [Webhooks](#webhooks)
- [Monitor HTTP endpoints](#monitor-http-endpoints)
- [XMTP push pipeline](#xmtp-push-pipeline)
- [Writing a train](#writing-a-train)
- [Project structure](#project-structure)
- [Scripts](#scripts)
- [Links](#links)

## What Metro is

Metro supervises per-platform "train" subprocesses living in `~/.metro/trains/`, multiplexes the JSON events they emit onto a single stdout stream, and forwards outbound action calls back into the matching train's stdin.

The wire knows nothing about Telegram, Discord, or XMTP. Platform behaviour is written as train scripts (by the user or an agent) on top of the transport this package provides, which keeps the core stable while integrations evolve freely. Each train is a `<name>.ts` file under `~/.metro/trains/`; the supervisor spawns it, restarts it with backoff on crash, and pipes a newline-delimited JSON protocol over stdin/stdout.

Three things flow across the wire:

- **Inbound events** - a train observes its platform (a Discord message, an XMTP reply, an HTTP webhook) and emits an [envelope](#the-event-envelope). The daemon stamps, logs, and multiplexes it onto stdout, and into the universal history log.
- **Outbound actions** - `metro <verb>` / `metro call <train> <action>` forwards a JSON action to the owning train's stdin via the daemon's IPC socket; the train delivers it to the platform.
- **State** - claims (who owns a line), history (the universal message log), and account/session bindings live in `~/.metro/` and are read by both the daemon and one-shot CLI invocations.

## Install and first run

```sh
npm install -g @metro-labs/metro
# or, from a clone of the monorepo:
bun install
```

Metro requires the [Bun](https://bun.sh) runtime (the CLI spawns trains with `Bun.spawn`).

```sh
metro setup            # print config status (credentials are owned by trains, not metro)
metro setup skill      # install the metro skill into ~/.claude / ~/.codex (skill clear to remove)
metro doctor           # health check
metro trains new xmtp  # scaffold ~/.metro/trains/xmtp.ts from the example
metro                  # run the dispatcher; emits JSON events on stdout
```

State and config live in `~/.metro/`: `trains/` (train scripts), `*-accounts.json` (per-station accounts), optional `sessions.json` (session bindings), `.env` (loaded by the CLI), plus the history log, claims, and webhook registry. If a dispatcher is already running, a bare `metro` does not start a competing daemon - it attaches as a live reader (`tail --follow --json --since=tail`) so a second agent can subscribe to the same feed.

## The Line scheme

Every conversational scope is a **Line** - an opaque URI of the form:

```
metro://<station>/<path>
```

The station (`discord`, `telegram`, `xmtp`, `claude`, `codex`, `webhook`, `session`, ...) is the host; the path is station-specific. A single typed `Line` parser (`src/lines.ts`) owns the whole scheme - stations never hand-roll regexes. Lines parse cleanly with the WHATWG `URL` parser too.

| Station    | Pattern                                       | Example                                       |
| ---------- | --------------------------------------------- | --------------------------------------------- |
| `discord`  | `metro://discord/[<account>/]<channel-id>`    | `metro://discord/1234567890123456789`         |
| `telegram` | `metro://telegram/<chat-id>[/<topic-id>]`     | `metro://telegram/-1001234567890/42`          |
| `xmtp`     | `metro://xmtp/<account>/<conversation-id>`    | `metro://xmtp/tony/abc123def456...`           |
| `claude`   | `metro://claude/<user-id>/<session-id>`       | `metro://claude/9bfc7af0-.../50b00d11-...`    |
| `codex`    | `metro://codex/<user-id>/<session-id>`        | `metro://codex/8119ecb1-.../01997d4b-...`     |
| `webhook`  | `metro://webhook/<endpoint-id>`               | `metro://webhook/fwaCgTKJuLAjS2K0`            |
| `session`  | `metro://session/<session-id>` (derived)      | `metro://session/alpha`                        |

Account-scoped stations (`xmtp`, `discord`) take an optional leading `<account>` segment selecting which configured account owns the line. The legacy single-segment form (`metro://xmtp/<conversation>`) is still accepted and maps to the `default` account. Participant URIs use a `user` segment: `metro://<station>/user/<id>` (used as `from`/`to` on events and history). The `session` URI is derived from `sessions.json`, not a wire line. See [`docs/uri-scheme.md`](docs/uri-scheme.md) for the full grammar and participant derivation.

## The event envelope

Inbound and outbound events share one shape (`Envelope` in `src/define-train.ts`):

```ts
type Envelope = {
  kind?: 'inbound' | 'outbound';
  id?: string;            // stamped by the daemon if absent
  ts?: string;            // ISO timestamp, stamped if absent
  station?: string;       // stamped from the owning train if absent
  line: string;           // the Line (required)
  line_name?: string;
  from?: string;          // participant URI
  from_name?: string;     // display name (@alice, bonustrack_)
  to?: string;            // local user / original sender on replies
  message_id?: string;
  reply_to?: string;
  is_private?: boolean;
  text?: string;
  emoji?: string;
  payload?: unknown;
  account?: string;       // which account the line/action targets
} & Record<string, unknown>;
```

Trains emit via `ctx.emit` / `ctx.emitInbound` / `ctx.emitOutbound`; the daemon stamps `id`/`ts`/`station` when missing and routes the result to stdout and history.

## CLI surface

`metro <verb>` is the porcelain; `metro call <train> <action>` is the low-level escape hatch. Lines are account-scoped (`metro://xmtp/<account>/<conversation>`; the legacy single-segment form maps to `default`).

### Messaging verbs

| Verb     | Usage                                                      | Does                                                              |
| -------- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| `send`   | `metro send <line> <text> [--reply <id>] [--attach <path\|url> ...] [--from <session\|account>]` | Send a message. `<text>` is inline, `@file`, or `-` (stdin).     |
| `reply`  | `metro reply <line> <msgId> <text>`                       | Reply to a message (sugar for `send --reply`).                   |
| `react`  | `metro react <line> <msgId> <emoji>`                      | Add an emoji reaction.                                            |
| `unreact`| `metro unreact <line> <msgId> <emoji>`                    | Remove an emoji reaction.                                         |
| `edit`   | `metro edit <line> <msgId> <text>`                        | Edit a previously-sent message (unsupported on XMTP).            |
| `delete` | `metro delete <line> <msgId>`                             | Delete a message (unsupported on XMTP).                          |
| `read`   | `metro read <line> [--limit N] [--before <id>] [--since <ts>]` | Read recent messages for a line (live or from the daemon log). |

### Themed porcelain verbs

Noun-verb commands, thin wrappers over the underlying `xmtp` train actions via the unchanged forward-call path. They add only the uniform [envelope](#global-flags-json-envelope-exit-codes), `--quiet`, and exit codes. `metro call` stays available.

| Verb                          | Usage                                                                    | Wraps                       |
| ----------------------------- | ----------------------------------------------------------------------- | --------------------------- |
| `channel set-github`          | `metro channel set-github <line> <url\|->`                               | `xmtp setGithub`            |
| `channel set-labels`          | `metro channel set-labels <line> <a,b,c>`                                | `xmtp setLabels`            |
| `channel meta`                | `metro channel meta <line> [--name N] [--description D] [--github U] [--labels a,b]` | `xmtp updateChannelMeta` |
| `channel info`                | `metro channel info <line>`                                              | `xmtp groupInfo`            |
| `group new`                   | `metro group new <0xaddr...> [--name N] [--admin-only]`                  | `xmtp newGroup`             |
| `group close`                 | `metro group close <line>`                                               | `xmtp closeGroup`           |
| `group add` / `group remove`  | `metro group add\|remove <line> <0xaddr...>`                             | `xmtp addMembers`/`removeMembers` |
| `group info`                  | `metro group info <line>`                                                | `xmtp groupInfo`            |
| `dm`                          | `metro dm <0xaddress> [--account <id>]`                                  | `xmtp newDm` (prints the line) |

### Identity verbs

| Verb              | Usage                                  | Does                                                                       |
| ----------------- | -------------------------------------- | ------------------------------------------------------------------------- |
| `whoami`          | `metro whoami [--json]`                | Resolved identity: owner URI, account per station, and the strict-tail command. |
| `session list`    | `metro session list [--json]`          | List `sessions.json` bindings (read-only; only `list` exists in this layer). |
| `account list`    | `metro account list [<station>]`       | List configured accounts (id, eth address, key source, owner).            |
| `account address` | `metro account address [<id>]`         | Print an account's fundable eth address (asks the live daemon).           |
| `account import`  | `metro account import <station> <privkey> --id <name>` | Import a raw-key account (xmtp only), written mode `0600`. Needs `metro trains restart <station>`. |

### Daemon and feed verbs

| Verb              | Usage                                                  | Does                                                          |
| ----------------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| (bare) `metro`    | `metro`                                               | Run the dispatcher, or attach as a live reader if one runs.  |
| `setup`           | `metro setup [skill [clear]]`                         | Config status; install/remove the metro skill.               |
| `doctor`          | `metro doctor`                                        | Health check.                                                |
| `lines`           | `metro lines`                                         | List recently-seen conversations.                            |
| `trains`          | `metro trains [list]` / `restart <name>` / `new <name>` | List / restart / scaffold trains.                         |
| `schema` / `verbs`| `metro schema [station] [--json]`                     | Dump the verb registry (human table or JSON).                |
| `history`         | `metro history [--limit=N] [--line=...] [--station=...] [--from=...] [--text=...] [--since=...]` | Read the universal message log (newest first). |
| `tail` / `board`  | `metro tail [--as=<uri>] [--follow] [--strict\|--unclaimed\|--all] [--include-webhooks] [--chat=<line>] [--station=...] [--since=<offset\|tail>] [--limit=N]` | Subscribe to the event log; claim-aware by default. `board` is the transit-naming alias. |
| `claim`           | `metro claim <line> [--as=<user-uri>]`                | Take exclusive ownership of a line.                          |
| `release`         | `metro release <line>`                                | Release a line back to broadcast.                            |
| `claims`          | `metro claims`                                        | Print the current claims map.                                |
| `webhook`         | `metro webhook add <label> [--secret=...] [--session=<id>]` / `list` / `remove <id>` | Manage HTTP receive endpoints. |
| `tunnel`          | `metro tunnel setup <name> <hostname>` / `status`    | Configure / inspect a Cloudflare named tunnel.               |
| `update`          | `metro update`                                        | Upgrade in place.                                            |

`metro tail --since`: a byte offset, or `tail` for EOF (live only). Omitted, it resumes from this reader's saved cursor. NB: the SSE `/api/tail` endpoint shares the flag name but defaults to EOF, not the cursor.

### `metro call` and the action reference

`metro call <train> <action> [args]` forwards an action to a train. `[args]` is JSON, `@file`, `-` (stdin), or a bare string handed to the train as-is.

```sh
metro call xmtp newGroup '{"addresses":["0x..."],"name":"my group"}'
metro call discord fetch '{"line":"metro://discord/<chan>","limit":20}'
```

The reference trains expose the following actions (the single source of truth is the [verb registry](#the-verb-registry); `read` = no remote write, `mutate` = writes/sends under an account identity).

**`xmtp`**

| Action | Kind | Args (key fields) |
| --- | --- | --- |
| `accounts` | read | - |
| `send` | mutate | `{line, text, account?}` |
| `reply` | mutate | `{line, replyTo, text, account?}` |
| `react` | mutate | `{line, messageId, emoji, account?}` |
| `sendAttachment` | mutate | `{line, account?}` (path or base64) |
| `sendImage` | mutate | `{line, dataB64, account?}` |
| `ask` / `sendPoll` | mutate | `{line, title, choices, account?}` |
| `sendTxRequest` | mutate | `{line, to, amountEth, account?}` |
| `sendSignatureRequest` | mutate | `{line, kind, account?}` (eip712 or personal) |
| `edit` / `delete` | mutate | unsupported on XMTP (immutable log) - uniform error |
| `newDm` | mutate | `{address, account?}` |
| `newGroup` | mutate | `{addresses, name?, permissions?}` |
| `createRequestGroup` | mutate | `{...}` |
| `setLabels` | mutate | `{line, labels}` |
| `setGithub` | mutate | `{line, url}` |
| `setPreview` | mutate | `{line, url}` |
| `updateChannelMeta` | mutate | `{line, name?, description?, appData?}` |
| `addMembers` / `removeMembers` | mutate | `{line, addresses}` |
| `closeGroup` | mutate | `{line}` |
| `query` | read | `{line}` |
| `groupInfo` | read | `{line}` |
| `listConvs` | read | - |
| `register-push` / `unregister-push` / `disable-push` | mutate | `{token, ...}` |
| `list-push` | read | - |
| `test-push` | mutate | `{title?, ...}` |

**`discord`**

| Action | Kind | Args (key fields) |
| --- | --- | --- |
| `accounts` | read | - |
| `send` | mutate | `{line, text?, account?}` |
| `reply` | mutate | `{line, messageId, text, account?}` |
| `react` | mutate | `{line, messageId, emoji?, account?}` (no emoji removes) |
| `edit` | mutate | `{line, messageId, text, account?}` |
| `delete` | mutate | `{line, messageId, account?}` |
| `fetch` | read | `{line, limit?, account?}` |
| `download` | read | `{line, messageId, account?}` |
| `thread_create` | mutate | `{line, name, account?}` |
| `pin` | mutate | `{line, messageId, account?}` |
| `typing` | mutate | `{line, account?}` |
| `channel` | read | `{line, account?}` |
| `set_presence` | mutate | `{status, ...}` |
| `joinVoice` / `leaveVoice` | mutate | `{line}` |
| `speak` | mutate | `{line, text}` |
| `voiceDebug` | read | `{line}` |
| `voiceTranscribe` | mutate | `{line}` |

**`telegram`**

| Action | Kind | Args (key fields) |
| --- | --- | --- |
| `accounts` | read | - |
| `send` | mutate | `{line, text?, account?}` |
| `react` | mutate | `{line, messageId, emoji?, account?}` (no emoji clears) |
| `edit` | mutate | `{line, messageId, text, account?}` |
| `delete` | mutate | `{line, messageId, account?}` |
| `send_photo` / `send_document` / `send_voice` | mutate | `{line, path, account?}` |
| `send_sticker` | mutate | `{line, sticker, account?}` |
| `send_dice` | mutate | `{line, account?}` |
| `send_location` | mutate | `{line, lat, lon, account?}` |
| `read` | read | `{line, account?}` |
| `download` | read | `{line, messageId, account?}` |

### Global flags, JSON envelope, exit codes

- `--json` - machine-readable output on any command. On error: `{"ok":false,"error":...,"code":...}`. Themed verbs (`channel`/`group`/`dm`) wrap success in a uniform envelope: `{"ok":true,"command":...,"result":...}` (and `{"ok":false,"command":...,"error":...,"code":...}` on error).
- `--quiet` - (themed verbs) print only the result id.
- `--from <session|account>` - (write verbs) route an outbound through a specific identity. A `<session>` id resolves through `sessions.json`; anything else is a literal account id.

Exit codes: `0` success - `1` usage - `2` config - `3` upstream - `4` daemon not running - `7` rate-limited.

## Multi-account

XMTP is multi-account today. Accounts are declared in `~/.metro/xmtp-accounts.json` (override path with `$XMTP_ACCOUNTS_FILE`), a JSON array of:

```json
[
  { "id": "tony", "privateKey": "0x...", "owner": "metro://claude/user/..." },
  { "id": "codex", "derive": 1, "owner": "metro://codex/user/..." }
]
```

- `privateKey` - a raw secp256k1 key (MetaMask-style import; validated and written `0600`).
- `derive` - an index into the mnemonic at `~/.metro/xmtp-mnemonic` (`$XMTP_MNEMONIC_FILE`).
- `owner` - the URI of the CLI session that owns this account; used by the [send-guard](#the-send-guard) for per-account identity isolation.

Each account has its own conversation feed and is selected by the account segment of a line (`metro://xmtp/<account>/<conv>`) or an explicit `account` arg. `accountForCall` precedence: explicit `account` > line's account segment > `default`.

Discord and Telegram also have per-station accounts files (`discord-accounts.json`, `telegram-accounts.json`) but bind 1:1 today, so `--from` is inert there. `metro account list` reports id, eth address (from the live daemon, which boots the clients), key source, and owner. Importing requires `metro trains restart <station>` to load the new account.

## Sessions

`~/.metro/sessions.json` is an optional, opt-in binding layer mapping a named session to a per-station account:

```json
{
  "alpha": { "xmtp": "tony", "discord": "main", "default": "tony" }
}
```

Each session derives an owner URI `metro://session/<id>`. Precedence for resolving an account: explicit station mapping > session `default`. When the file is absent (the default), every helper returns null/empty and identity falls back to the env / per-account-owner behavior, byte-for-byte unchanged. The file is read-only from the CLI (`metro session list`), should be mode `0600` (a warning fires otherwise), and never throws on a bad file - a malformed `sessions.json` must not change daemon routing.

`metro whoami` reports the resolved identity: `source` (`session` when a binding applies, else `env`), the owner URI, the per-station accounts, the participant `self`/`line`, and the suggested `--strict` tail command for this identity's feed. The active session id comes from `$METRO_SESSION` > the CLI's own claude/codex session id.

## The verb registry

`src/registry.ts` is the single source of truth for every station/core verb. Each verb is declared once with `{name, owner, kind, idempotent, description, example, inputSchema?}`:

- `owner` - `xmtp` | `discord` | `telegram` | `core`.
- `kind` - `read` (no remote write) or `mutate` (writes/sends under an account identity).
- `inputSchema` - an optional runtime validator (the same zero-dependency combinator the control verbs use).
- `idempotent` - whether re-presenting the same call is safe.

That one declaration feeds: `metro schema` / `metro verbs` introspection (human table + `--json`), CLI help/validation, and the [send-guard's](#the-send-guard) notion of which actions mutate. The registry is additive and behavior-preserving - it describes today's behavior, it does not change any runtime path.

```sh
metro schema            # full table grouped by owner
metro schema xmtp       # filter to one station
metro schema --json     # {verbs:[{name,owner,kind,idempotent,description,example,hasInputSchema}, ...]}
```

## The send-guard

One daemon can serve multiple CLIs (e.g. a Claude session on the `tony` account and a Codex session on the `codex` account). A `metro call xmtp send` sends from whatever account the line names, so a Codex-side caller could accidentally send under the `tony` identity. The send-guard (`src/cli/send-guard.ts`) rejects an outbound XMTP `send`/`reply`/`react`/`sendAttachment`/`newDm`/`newGroup` when the caller's session does not own the target account.

It derives the guarded set from the registry's `xmtp` mutate verbs (a parity test asserts the guard's set is a subset). It enforces only when BOTH the caller station and the target account's owner station are known AND they conflict; otherwise it allows (a human running metro directly, an account with no owner). `METRO_ALLOW_CROSS_ACCOUNT=1` is an explicit escape hatch.

## Webhooks

`metro webhook add <label> [--secret=<shared-secret>] [--session=<id>]` registers an HTTP receive endpoint (GitHub, Intercom, ...) and prints its URL. Inbound HTTP requests arrive on the `metro://webhook/<endpoint-id>` line.

When an endpoint is bound to a session (`--session=<id>`), the daemon attributes inbound webhook events to that session's owner: `to` becomes `metro://session/<id>` instead of the bare webhook line (`src/dispatcher/server.ts`), so webhook traffic flows into the right identity's feed. `metro webhook list` / `metro webhook remove <id>` manage the registry.

## Monitor HTTP endpoints

The daemon answers a small HTTP API on dedicated hostnames (`monitor.metro.box,localhost,127.0.0.1` by default; override with `$METRO_MONITOR_HOSTS`). It requires a bearer token: `$METRO_MONITOR_TOKEN` (unset -> `503`; bad token -> `401`). A `?token=` query param is accepted for media tags that cannot send an `Authorization` header. CORS reflects the request `Origin`.

| Endpoint | Method | Does |
| --- | --- | --- |
| `/api/state` | GET | Claims, lines, recent history, bot ids, version. `?limit=` (<=500), `?before=` for paging. |
| `/api/tail` | GET | SSE event stream. Shares the tail filters (`as`, `mode`/`strict`/`unclaimed`/`all`, `chat`, `station`, `include_webhooks`, `exclude_from`, `since`). Defaults to EOF, not the cursor. |
| `/api/call/<train>/<action>` | POST | Forward an action to a train via the IPC `forward-call` path. JSON body `{args}`, max 256 KiB. |

See [`docs/monitor.md`](docs/monitor.md) for the full HTTP contract and [`docs/broker.md`](docs/broker.md) for claims + history streaming.

## XMTP push pipeline

The `xmtp` station carries an FCM push pipeline so app clients receive notifications for new conversation events. Tokens are registered/queried/removed via the `register-push` / `list-push` / `unregister-push` / `disable-push` actions (and `test-push` to send a test notification). The daemon-side fan-out lives in `src/stations/xmtp/push.ts` (with `actions-push.ts` and `push-title.ts`); see the station source for the contentless-push and title-derivation details.

## Writing a train

```ts
import { defineTrain } from '@metro-labs/metro/define-train';

export default defineTrain({
  station: 'example',
  async onInbound({ emit }) {
    emit({ line: 'metro://example/demo', from: 'someone', text: 'hi' });
  },
  actions: {
    async send({ line, text }) {
      // deliver `text` to `line` on your platform
    },
  },
});
```

Place `<name>.ts` files in `~/.metro/trains/` (`metro trains new <name>` scaffolds one from the example). The supervisor spawns the train, restarts it with backoff on crash, and pipes the newline-delimited JSON protocol. `ctx` provides `emit`/`emitInbound`/`emitOutbound`, the daemon self URI, per-account handles, and a structured `log`.

## Project structure

```
src/
  cli/            # the `metro` command (verbs, channels, account, webhook, tail, monitor-api)
  trains/         # train supervisor + the train<->daemon protocol
  stations/       # built-in station normalizers (discord, telegram, xmtp)
  broker/         # claims + history streaming between daemon and clients
  codex-rc/       # codex bridge (protocol, client)
  dispatcher/     # outbound action routing + webhook attribution
  registry*.ts    # the verb registry (single source of truth) + types
  sessions.ts     # sessions.json binding layer
  lines.ts        # the typed metro:// Line parser
  schema.ts       # the control-verb + metro-call validator
  define-train.ts # public helper for authoring trains
docs/             # uri-scheme, broker, monitor (shipped with the package)
skills/metro/     # the agent-facing SKILL.md
examples/         # example train scripts
```

## Scripts

| Script              | Description                                  |
| ------------------- | -------------------------------------------- |
| `bun run build`     | Compile `src/` to `dist/` with `tsc`.        |
| `bun run typecheck` | Type-check without emitting.                 |
| `bun run lint`      | Lint `src/` and `examples/`.                 |
| `bun run lint:fix`  | Lint and auto-fix.                           |
| `bun test`          | Run the test suite in an isolated state dir. |

## Links

- Monorepo: [bonustrack/stage](https://github.com/bonustrack/stage)
- Agent playbook: [`skills/metro/SKILL.md`](skills/metro/SKILL.md)
- URI scheme: [`docs/uri-scheme.md`](docs/uri-scheme.md)
- CLI architecture: [`../../docs/metro-cli-architecture.md`](../../docs/metro-cli-architecture.md)
- Consumer: [`apps/api`](../../apps/api) shells the `metro` CLI to create daemon-owned groups
