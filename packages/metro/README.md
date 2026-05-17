# Metro

[![npm](https://img.shields.io/npm/v/@stage-labs/metro/beta?label=npm&color=cb3837)](https://www.npmjs.com/package/@stage-labs/metro)
[![lines of code](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.codetabs.com%2Fv1%2Floc%2F%3Fgithub%3Dbonustrack%2Fmetro&query=%24%5B0%5D.linesOfCode&label=lines%20of%20TypeScript&color=blue)](https://github.com/bonustrack/metro)

> **A live JSON stream of Telegram, Discord, webhooks, and cross-user messages for your local Claude Code / Codex session.**

Metro is (a) a Bun monorepo of station packages (one per integration), (b) a Client SDK that loads them, (c) a CLI that thinly wraps the SDK. You launch the daemon from inside your session; metro emits one JSON line per inbound on stdout (Claude Code's `Monitor` consumes it natively; Codex picks it up via an app-server WebSocket push). Outbound goes through one generic call:

```bash
metro <station> <action> <args.json|@file|->
```

The core knows nothing about the action set — each station declares its own.

```
[Claude Code session]

$ metro &                              # backgrounded
$ Monitor( … metro's stdout … )

>>> {"kind":"inbound","station":"discord","line":"metro://discord/123…","messageId":"9876",
     "text":"@metro we got a 5xx spike from /v1/sync. Look?",
     "payload":{"channelId":"123…","guildId":"456…","content":"<@…> we got a 5xx spike…",
                "mentions":{"users":["<bot-id>"],"roles":[],"everyone":false},…}}

  [I'd run git log + read services/sync.ts, then…]
  Bash: metro discord reply '{"line":"metro://discord/123…","messageId":"9876","text":"three deploys in the last 24h…"}'
```

You own your own streaming, tool calls, and reply timing. Metro is the wire.

---

## Quickstart

```bash
npm install -g @stage-labs/metro@beta    # or: bun add -g @stage-labs/metro@beta

metro setup discord <token>              # https://discord.com/developers/applications
metro setup telegram <token>             # https://t.me/BotFather
metro doctor                             # verify
metro                                    # run the daemon
```

Requires **Node ≥ 22 or Bun ≥ 1.3**. Metro doesn't launch Claude or Codex — you do, and the user launches metro. See [`docs/users.md`](docs/users.md).

In **Discord**: DM the bot, or `@<bot>` in any channel. In **Telegram**: DM, or `@<bot>` in a forum supergroup. Every inbound becomes one JSON line on `metro`'s stdout.

---

## Architecture

```
packages/*-station/     (one per integration — discord, telegram, webhook, claude, codex, …)
     │
     ▼  default-export Station
@stage-labs/metro Client    (workspace discovery + start/stop + .call(station, action, args))
     │
     ▼  envelope on EventEmitter
metro daemon ───▶ stdout (JSON envelopes; Claude Code's Monitor reads here)
             ───▶ codex-rc WebSocket (Codex turn/start; opt-in)
             ◀── IPC Unix socket  (metro <station> <action> from another process)
```

- **Inversion of control.** Claude Code / Codex launches `metro`, not the other way around. Metro never spawns a Claude / Codex process.
- **Single daemon per machine.** Lockfile at `$METRO_STATE_DIR/.tail-lock` enforces singleton.
- **Account-tied identity.** `to` on inbound and `from` on outbound resolve to a stable account-scoped URI per runtime: `metro://claude/user/<orgId>` (from `claude auth status --json`) or `metro://codex/user/<accountId>` (from `$CODEX_HOME/auth.json`). Same on any device for the same logged-in account.
- **Codex push (opt-in).** Set `METRO_CODEX_RC=ws://127.0.0.1:8421` and metro pushes each event via JSON-RPC `turn/start` to the Codex app-server. Codex's TUI must be attached with `--remote` to the same URL.
- **Cross-user notification.** `metro claude notify '{"line":"metro://claude/…","text":"…"}'` (or `metro codex notify`) routes through the daemon's IPC socket; the daemon re-emits on its stdout (and pushes to codex-rc), so the peer sees it. Discover reachable users/sessions via `metro stations` or `$METRO_STATE_DIR/user-registry.json`.
- **Webhooks (opt-in).** `metro webhook add <label>` registers an HTTP receive endpoint; the daemon binds `127.0.0.1:8420` (override with `$METRO_WEBHOOK_PORT`). If you've run `metro tunnel setup`, a Cloudflare named tunnel exposes it publicly. Each POST is re-emitted on stdout as an inbound event.

---

## Stations

Each integration is its own workspace package under `packages/<name>-station/`,
default-exporting a `Station` object (`name`, `configured()`, `start(emit)`,
`stop()`, `actions: {…}`). The Client scans `packages/*-station/` at startup,
loads the ones flagged `"metroStation": true`, and starts the configured ones.

| Package              | Actions                                              | Config                                                                                  |
|----------------------|------------------------------------------------------|-----------------------------------------------------------------------------------------|
| `discord-station`    | reply · send · react · edit · download · fetch · getMe | `DISCORD_BOT_TOKEN` + Message Content Intent                                            |
| `telegram-station`   | reply · send · react · edit · download · fetch · getMe | `TELEGRAM_BOT_TOKEN`                                                                    |
| `claude-station`     | notify · whoami                                       | auto-detected from `$CLAUDECODE`; identity via `claude auth status --json`              |
| `codex-station`      | notify · whoami                                       | auto-detected from `$METRO_CODEX_RC` / `$CODEX_HOME`; identity via `$CODEX_HOME/auth.json` |
| `webhook-station`    | (receive-only; optional HMAC verify)                 | `metro webhook add <label>` + `metro tunnel setup` (Cloudflare named tunnel)            |

Run `metro stations` to see what loaded + which actions each station exposes.

### Adding a new station

```
cp -r packages/_station-template packages/<name>-station
```

Then in the new folder:

1. `package.json` — rename, flip `"metroStation": true`, declare any deps.
2. `index.ts` — fill in `name`, `configured()`, `start(emit)`, `stop()`, and
   the `actions` object. Each action is `async ({...}) => result`. There is
   no "outbound primitive" the core requires — declare whatever your platform
   exposes.

That's the whole contract. Five functions.

Behaviors worth knowing:
- **No streaming / no edit machinery in metro.** The local CLI runs the show; metro is one-shot REST.
- **No link previews.** Outgoing messages set `link_preview_options.is_disabled` on Telegram and `SUPPRESS_EMBEDS` on Discord.
- **Image attachments inbound** — `[image]` placeholders surface inline in `text`; the user calls `metro <station> download '{"line":"…","messageId":"…","outDir":"/tmp/dl"}'` to materialize them. 20 MB cap.
- **Rich content outbound.** Discord + Telegram `send`/`reply` accept `images`/`documents`/`voice`/`buttons` inside the args JSON. `edit` accepts `buttons`. 20 MB / file. URL buttons only for now — no callback/interactive components.
- **Telegram non-forum groups are skipped.** No thread boundary to scope on.
- **Webhook signature verification.** Pass `--secret=<shared-secret>` to `metro webhook add` and the daemon verifies `X-Hub-Signature-256` (GitHub/Intercom format) on every POST. Mismatches return 401 and never reach the stream.

---

## Webhooks

Receive HTTP events from third parties (GitHub, Intercom, Fireflies, anything that POSTs) as standard metro inbound events. Each registered endpoint is one Line.

```bash
# One-time per machine — bring your own Cloudflare domain (free Registrar at-cost):
brew install cloudflared
cloudflared tunnel login                       # browser OAuth, pick your domain
metro tunnel setup metro webhook.example.com   # creates tunnel + DNS CNAME

# Per endpoint — repeat for each provider:
metro webhook add github --secret=$(openssl rand -hex 32)
# → https://webhook.example.com/wh/<id>
# (without `metro tunnel setup`, falls back to http://127.0.0.1:8420/wh/<id> — local-only)

metro                                          # daemon binds 8420 + spawns cloudflared automatically
```

Paste the URL into the provider's webhook settings (for GitHub: **Content type must be `application/json`** — form-encoded won't parse). Every POST becomes an inbound event with `station: "webhook"`, `line: metro://webhook/<id>`, `payload: { headers, body }`. If you set `--secret`, metro verifies the `X-Hub-Signature-256` header (GitHub/Intercom format) and rejects mismatches with 401.

| Action | Command |
|---|---|
| Register an endpoint | `metro webhook add <label> [--secret=<shared-secret>]` |
| List endpoints + URLs | `metro webhook list` |
| Remove an endpoint | `metro webhook remove <id>` |
| One-time tunnel setup | `metro tunnel setup <tunnel-name> <hostname>` |
| Tunnel status | `metro tunnel status` |

The tunnel is optional — without it the listener binds `127.0.0.1:8420` only (good for local testing or your own loopback tools). With Cloudflare named tunnels, the URL stays stable across daemon restarts and machines. See [docs/uri-scheme.md](docs/uri-scheme.md) and [docs/users.md](docs/users.md) for the full event shape.

---

## Lines

Every conversational scope is identified by a **Line** — a URI in the form `metro://<station>/<path>`:

```
metro://discord/1234567890123456789
metro://telegram/-1001234567890                 # main chat / DM
metro://telegram/-1001234567890/42              # forum topic 42
metro://claude/9bfc7af0-…/50b00d11-…            # claude user session
metro://codex/8119ecb1-…/01997d4b-…             # codex user session
metro://webhook/fwaCgTKJuLAjS2K0                # HTTP webhook endpoint
```

Anyone can post to a line via the station's send/notify action — see the [CLI](#cli) section. Daemon required only for Claude / Codex lines. Full grammar in [`docs/uri-scheme.md`](docs/uri-scheme.md).

---

## CLI

```
metro                                       Run the daemon (emits JSON envelopes on stdout).
metro <station> <action> <args>             Generic dispatch. args = JSON | @file | -.
                                            e.g. metro discord reply '{"line":"…","messageId":"…","text":"hi"}'
                                            e.g. metro gmail send '{"to":"a@b.c","subject":"…","body":"…"}'
                                            e.g. metro github comment '{"repo":"x/y","issue":42,"body":"…"}'
metro setup [telegram|discord <token>]      Save token, or show status.
metro setup clear [telegram|discord|all]    Remove tokens.
metro doctor                                Health check.
metro stations                              List discovered stations + actions.
metro lines                                 List recently-seen conversations.
metro history [--limit=N] [--line=…] [--station=…] [--kind=…] [--from=…] [--text=…] [--since=…]
                                            Universal message log, newest first.
metro tail [--as=<user-uri>] [--follow] [--strict | --unclaimed | --all] [--include-webhooks]
           [--chat=<line>] [--station=…] [--since=<offset|tail>] [--limit=N]
                                            Subscribe to the event log.
metro claim <line> [--as=<user-uri>]        Take exclusive ownership.
metro release <line>                        Release a line.
metro claims                                Print the current claims map.
metro webhook add <label> [--secret=…]      Register an HTTP receive endpoint.
metro webhook list | remove <id>            List or remove webhook endpoints.
metro tunnel setup <name> <hostname>        Configure a Cloudflare named tunnel for public webhook URLs.
metro tunnel status                         Show current tunnel config.
metro update                                Upgrade in place.
```

`<args>` is a JSON object string, `@path/to/file`, or `-` (read from stdin).
Append `--json` to any subcommand for parseable output.

**State files** in `$METRO_STATE_DIR` (default `~/.cache/metro`):
- `USERS.md` — user skill copied from the package on every start (so the path is stable across upgrades)
- `history.jsonl` — universal message log (one JSON object per line; append-only). Read with `metro history`. Each entry carries `from` and `to` as universal participant URIs (`metro://<station>/user/<id>`, `metro://claude/user/<orgId>`, `metro://codex/user/<accountId>`) plus a `fromName` display field. The dispatcher auto-detects the local user for `to` on inbound (`$CLAUDECODE` → `metro://claude/user/<orgId>` from `claude auth status --json`; `$METRO_CODEX_RC`/`$CODEX_HOME` → `metro://codex/user/<accountId>` from `$CODEX_HOME/auth.json`).
- `bot-ids.json` — `{discord: "<botUserId>", telegram: "<botUserId>"}` written by the daemon on startup (cached for the few historical lookups that still need a platform-side bot identity).
- `lines.json` — line → last-seen / name cache (read by `metro lines`)
- `user-registry.json` — every `(station, user-id, sessions[])` tuple metro has seen; surfaced under each Claude / Codex row in `metro stations`
- `stations/codex/session-id` — current codex-rc thread id (daemon writes on handshake; CLI processes read for `metro://codex/<user-id>/<session>`)
- `webhooks.json` — registered HTTP receive endpoints (id, label, optional shared secret)
- `tunnel.json` — Cloudflare named-tunnel config (`{name, hostname}`); when present, the daemon spawns `cloudflared tunnel run`. The token is resolved via `cloudflared tunnel token <name>` and passed through as `TUNNEL_TOKEN`, so the per-tunnel credentials JSON at `~/.cloudflared/<id>.json` is not required (the named-form spawn is the fallback when the token call fails)
- `.tail-lock` — dispatcher pid
- `metro.sock` — daemon IPC socket
- `telegram-offset.json` — last processed update id

---

## SDK

`@stage-labs/metro` also exposes a `Client` class — useful if you want to drive
stations from your own code instead of through the CLI:

```ts
import { Client } from '@stage-labs/metro';

const metro = new Client();
metro.on('event', e => console.log(e.kind, e.station, e.text));
metro.on('error', (err, station) => console.warn(`${station}:`, err.message));
await metro.start();

await metro.call('discord', 'reply', { line: '…', messageId: '…', text: 'hi' });
await metro.call('gmail',   'send',  { to: 'a@b.c', subject: '…', body: '…' });
await metro.call('github',  'comment', { repo: 'x/y', issue: 42, body: '…' });

await metro.stop();
```

`.call(station, action, args)` is the only outbound primitive. The Client discovers
stations from `packages/*-station/` in the surrounding workspace (or from an
explicit `{ stations: [...] }` opt).

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN`, `DISCORD_BOT_TOKEN` | — | Bot tokens. `metro setup` writes them here. |
| `METRO_CODEX_RC` | — | Codex app-server URL (`ws://…`, `wss://…`, `unix:///…`). When set, the daemon pushes each event via JSON-RPC `turn/start`. |
| `METRO_WEBHOOK_PORT` | `8420` | Local port the HTTP webhook listener binds to (always `127.0.0.1`; expose publicly via Cloudflare tunnel). |
| `METRO_USER_ID` | — | Override the resolved user id (orgId / accountId) used in `metro://<station>/user/<id>` and `metro://<station>/<id>/<session>`. Useful for testing. |
| `METRO_USER_SESSION_ID` | — | Override the resolved session id (Claude session / Codex thread). |
| `METRO_FROM` | — | Pin a custom `from` URI for all writes (overrides runtime detection). |
| `METRO_CONFIG_DIR` | `~/.config/metro` | Where the global `.env` lives. |
| `METRO_STATE_DIR` | `~/.cache/metro` | Lockfile, line cache, IPC socket, telegram offset, registries, tunnel config. |
| `METRO_LOG_LEVEL` | `info` | `trace` / `debug` / `info` / `warn` / `error` / `fatal`. |

Precedence: process env → `./.env` → `$METRO_CONFIG_DIR/.env`. Logs go to stderr.

---

## Develop

```bash
git clone https://github.com/bonustrack/metro && cd metro
bun install && bun run build
bun link                                 # makes `metro` resolve to this checkout
METRO_LOG_LEVEL=debug metro

bun run typecheck                        # ts
bun run lint                             # eslint
```

Source map:

- [`src/cli/`](src/cli/) — `metro` binary entry ([`index.ts`](src/cli/index.ts)) + admin commands ([`config.ts`](src/cli/config.ts): setup/doctor/update), action handlers ([`actions.ts`](src/cli/actions.ts): send/reply/edit/react/download/fetch), webhook + tunnel commands ([`webhook.ts`](src/cli/webhook.ts)), and shared CLI primitives ([`util.ts`](src/cli/util.ts)).
- [`src/dispatcher.ts`](src/dispatcher.ts) — the daemon: starts each station, emits events on stdout, listens on the IPC socket, optionally pushes to codex-rc, supervises the Cloudflare tunnel.
- [`src/stations/`](src/stations/) — Line URI scheme + ChatStation interface + listing ([`index.ts`](src/stations/index.ts)). Chat impls: [`discord.ts`](src/stations/discord.ts), [`telegram.ts`](src/stations/telegram.ts) (+ [`telegram-md.ts`](src/stations/telegram-md.ts) markdown helper). User identity resolvers: [`claude.ts`](src/stations/claude.ts) (orgId via `claude auth status --json`), [`codex.ts`](src/stations/codex.ts) (account_id via `auth.json`). HTTP receive: [`webhook.ts`](src/stations/webhook.ts).
- [`src/codex-rc.ts`](src/codex-rc.ts) — Codex app-server WebSocket push client (also exposes the rc thread id used as Codex session-id).
- [`src/tunnel.ts`](src/tunnel.ts) — Cloudflared named-tunnel supervisor.
- [`src/webhooks.ts`](src/webhooks.ts) — webhook endpoint store (`webhooks.json` CRUD).
- [`src/registry.ts`](src/registry.ts) — user registry: `(station, user-id, sessions[])` tracking.
- [`src/history.ts`](src/history.ts) — universal message log + `userSelf()` / `selfLine()` identity helpers.
- [`src/ipc.ts`](src/ipc.ts) — Unix-socket IPC between the daemon and one-shot CLI commands.
- [`src/cache.ts`](src/cache.ts) — in-memory line cache with debounced flush to `lines.json`, plus bot-id cache.
- [`docs/uri-scheme.md`](docs/uri-scheme.md) specs the Line format; [`docs/users.md`](docs/users.md) is the in-context skill for users.

CI runs typecheck + lint + build on every PR via [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

---

## Caveats

- **No allowlist on chat stations.** Anyone who can DM/`@`-mention your bot can produce events. Run against bots you own.
- **Webhook secrets are optional but recommended.** Without `--secret`, anyone who learns the endpoint URL can POST events. With it, metro verifies `X-Hub-Signature-256` and rejects mismatches.
- **Telegram bot privacy is on by default**, which can block `@`-mentions in groups. Disable via [@BotFather](https://t.me/BotFather) → Bot Settings → Group Privacy, then kick + re-invite.
- **Telegram non-forum groups are skipped.** No thread boundary to scope on. DMs and forum topics work normally.
- **Telegram fetch isn't supported** (bot API doesn't expose history); `metro telegram fetch` returns `[]` on Telegram lines.
- **Cloudflared is your responsibility.** `metro tunnel setup` records the named tunnel; you still install `cloudflared` (`brew install cloudflared`) and run `cloudflared tunnel login` once.

---

## Uninstall

```bash
metro setup clear
rm -rf ~/.cache/metro
npm uninstall -g @stage-labs/metro
```
