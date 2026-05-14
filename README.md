# Metro

> **A live JSON stream of Telegram, Discord, webhooks, and cross-agent messages for your local Claude Code / Codex session.**

Metro is a small daemon you launch from inside your agent. It connects to Discord, Telegram, and any third-party service that can POST a webhook (GitHub, Intercom, Fireflies, …), emits each inbound as one JSON line on stdout (which Claude Code's `Monitor` consumes natively, and Codex picks up via an app-server WebSocket push), and exposes a tiny CLI — `metro reply`, `metro send`, `metro edit`, `metro react`, `metro download`, `metro fetch` — for posting back. Cross-agent: any agent can ping any other via `metro send metro://claude/<agent-id>/<session-id>` and the daemon re-emits it on the stream.

```
[Claude Code session]

$ metro &                              # backgrounded
$ Monitor( … metro's stdout … )

>>> {"kind":"inbound","station":"discord","line":"metro://discord/123…","messageId":"9876",
     "text":"@bot we got a 5xx spike from /v1/sync. Look?",
     "payload":{"channelId":"123…","guildId":"456…","content":"<@…> we got a 5xx spike…",
                "mentions":{"users":["<bot-id>"],"roles":[],"everyone":false},…}}

  [I'd run git log + read services/sync.ts, then…]
  Bash: metro reply metro://discord/123… 9876 "three deploys in the last 24h…"
```

The agent owns its own streaming, tool calls, and reply timing. Metro is the wire.

---

## Quickstart

```bash
npm install -g @stage-labs/metro@beta    # or: bun add -g @stage-labs/metro@beta

metro setup discord <token>              # https://discord.com/developers/applications
metro setup telegram <token>             # https://t.me/BotFather
metro doctor                             # verify
metro                                    # run the daemon
```

Requires **Node ≥ 22 or Bun ≥ 1.3**. Metro doesn't launch Claude or Codex — you do, and the agent launches metro. See [`docs/agents.md`](docs/agents.md).

In **Discord**: DM the bot, or `@<bot>` in any channel. In **Telegram**: DM, or `@<bot>` in a forum supergroup. Every inbound becomes one JSON line on `metro`'s stdout.

---

## Architecture

```
Discord gateway     ──┐
Telegram poller     ──┤
Cloudflare tunnel   ──┤ ── HTTP webhooks (GitHub, Intercom, …)
                      │
                      ├─▶ metro daemon ───▶ stdout (JSON events; Claude Code's Monitor reads here)
                      │                ───▶ codex-rc WebSocket (Codex turn/start; opt-in)
                      │                ◀── IPC Unix socket  (metro send to agent lines)
                      │
agent CLI calls   ────┴── REST → Discord / Telegram   (metro reply / send / edit / react / download / fetch)
```

- **Inversion of control.** The agent (Claude Code, Codex) launches `metro`, not the other way around. Metro never spawns an agent process.
- **Single daemon per machine.** Lockfile at `$METRO_STATE_DIR/.tail-lock` enforces singleton.
- **Account-tied identity.** `to` on inbound and `from` on outbound resolve to a stable account-scoped URI per runtime: `metro://claude/user/<orgId>` (from `claude auth status --json`) or `metro://codex/user/<accountId>` (from `$CODEX_HOME/auth.json`). Same on any device for the same logged-in account.
- **Codex push (opt-in).** Set `METRO_CODEX_RC=ws://127.0.0.1:8421` and metro pushes each event via JSON-RPC `turn/start` to the Codex app-server. Codex's TUI must be attached with `--remote` to the same URL.
- **Cross-agent notification.** `metro send metro://claude/<agent-id>/<session-id>` (or `metro://codex/<agent-id>/<session-id>`) routes through the daemon's IPC socket; the daemon re-emits on its stdout (and pushes to codex-rc), so the peer agent sees it. Discover reachable agents/sessions via `metro stations` or `$METRO_STATE_DIR/agent-registry.json`.
- **Webhooks (opt-in).** `metro webhook add <label>` registers an HTTP receive endpoint; the daemon binds `127.0.0.1:8420` (override with `$METRO_WEBHOOK_PORT`). If you've run `metro tunnel setup`, a Cloudflare named tunnel exposes it publicly. Each POST is re-emitted on stdout as an inbound event.

---

## Stations

Each endpoint is a **station** with declared capabilities:

| Station    | Kind    | Modalities    | Features                                              | Config                                                                                  |
|------------|---------|---------------|-------------------------------------------------------|-----------------------------------------------------------------------------------------|
| `discord`  | chat    | text + image  | reply, send, edit, react, download, fetch             | `DISCORD_BOT_TOKEN` + Message Content Intent                                            |
| `telegram` | chat    | text + image  | reply, send, edit, react, download                    | `TELEGRAM_BOT_TOKEN`                                                                    |
| `claude`   | agent   | text          | send, notify                                          | auto-detected from `$CLAUDECODE`; identity via `claude auth status --json`              |
| `codex`    | agent   | text          | send, notify                                          | auto-detected from `$METRO_CODEX_RC` / `$CODEX_HOME`; identity via `$CODEX_HOME/auth.json` |
| `webhook`  | service | text          | (receive-only; optional HMAC verify)                  | `metro webhook add <label>` + `metro tunnel setup` (Cloudflare named tunnel)            |

Run `metro stations` to see live config status (`✓` configured, `✗` not, `·` informational).

Behaviors worth knowing:
- **No streaming / no edit machinery in metro.** The agent runs the show; metro is one-shot REST.
- **No link previews.** Outgoing messages set `link_preview_options.is_disabled` on Telegram and `SUPPRESS_EMBEDS` on Discord.
- **Image attachments inbound** — `[image]` placeholders surface inline in `text`; the agent calls `metro download` to materialize them. 20 MB cap.
- **Rich content outbound.** `metro send` / `reply` accept `--image=<path>` (repeatable: albums of up to 10), `--document=<path>` (repeatable), `--voice=<path>` (single voice message — Telegram renders the voice bubble), and `--buttons='[[{"text":"…","url":"…"}]]'` for inline URL-button keyboards. `metro edit` accepts `--buttons` (pass `'[]'` to clear). 20 MB / file. URL buttons only for now — no callback/interactive components.
- **Telegram non-forum groups are skipped.** No thread boundary to scope on.
- **Webhook signature verification.** Pass `--secret=<shared-secret>` to `metro webhook add` and the daemon verifies `X-Hub-Signature-256` (GitHub/Intercom format) on every POST. Mismatches return 401 and never reach the stream.

---

## Webhooks

Receive HTTP events from third parties (GitHub, Intercom, Fireflies, anything that POSTs) as standard metro inbound events. Each registered endpoint is one Line.

```bash
metro tunnel setup metro webhook.example.com    # one-time: requires `cloudflared` + your CF account/domain
metro webhook add github --secret=$(openssl rand -hex 32)
# → http://127.0.0.1:8420/wh/<id>     (local)  or
# → https://webhook.example.com/wh/<id>  (with tunnel)
metro                                            # daemon spawns cloudflared automatically
```

Paste the URL into the provider's webhook settings. Every POST becomes an inbound event with `station: "webhook"`, `line: metro://webhook/<id>`, `payload: { headers, body }`. If you set `--secret`, metro verifies the `X-Hub-Signature-256` header (GitHub/Intercom format) and rejects mismatches with 401.

| Action | Command |
|---|---|
| Register an endpoint | `metro webhook add <label> [--secret=<shared-secret>]` |
| List endpoints + URLs | `metro webhook list` |
| Remove an endpoint | `metro webhook remove <id>` |
| One-time tunnel setup | `metro tunnel setup <tunnel-name> <hostname>` |
| Tunnel status | `metro tunnel status` |

The tunnel is optional — without it the listener binds `127.0.0.1:8420` only (good for local testing or your own loopback tools). With Cloudflare named tunnels, the URL stays stable across daemon restarts and machines. See [docs/uri-scheme.md](docs/uri-scheme.md) and [docs/agents.md](docs/agents.md) for the full event shape.

---

## Lines

Every conversational scope is identified by a **Line** — a URI in the form `metro://<station>/<path>`:

```
metro://discord/1234567890123456789
metro://telegram/-1001234567890                 # main chat / DM
metro://telegram/-1001234567890/42              # forum topic 42
metro://claude/9bfc7af0-…/50b00d11-…            # claude agent session
metro://codex/8119ecb1-…/01997d4b-…             # codex agent session
metro://webhook/fwaCgTKJuLAjS2K0                # HTTP webhook endpoint
```

Anyone can post to a line via [`metro send`](#cli) — daemon required only for agent lines. Full grammar in [`docs/uri-scheme.md`](docs/uri-scheme.md).

---

## CLI

```
metro                                       Run the daemon (emits JSON events on stdout).
metro setup [telegram|discord <token>]      Save token, or show status.
metro setup clear [telegram|discord|all]    Remove tokens.
metro doctor                                Health check.
metro stations                              List stations + capabilities.
metro lines                                 List recently-seen conversations.
metro send <line> <text> [--image=…]… [--document=…]… [--voice=…] [--buttons=…]
                                            Post a fresh message; --image/--document repeat for albums.
metro reply <line> <message_id> <text> [--image|--document|--voice|--buttons]
                                            Threaded reply (same flags as send).
metro edit <line> <message_id> <text> [--buttons=<json>]
                                            Edit a previously-sent message (text + URL-button keyboard).
metro react <line> <message_id> <emoji>     Set or clear ('') a reaction.
metro download <line> <message_id> [--out=<dir>]
                                            Download image attachments to disk.
metro fetch <line> [--limit=N]              Recent-message lookback (Discord only).
metro history [--limit=N] [--line=…] [--station=…] [--kind=…] [--from=…] [--text=…] [--since=…]
                                            Universal message log (every inbound + outbound), newest first.
metro webhook add <label> [--secret=…]      Register an HTTP receive endpoint (GitHub, Intercom, …).
metro webhook list | remove <id>            List or remove webhook endpoints.
metro tunnel setup <name> <hostname>        Configure a Cloudflare named tunnel for public webhook URLs.
metro tunnel status                         Show current tunnel config.
metro update                                Upgrade in place.
```

All commands accept `--json`. `reply` / `send` / `edit` read multi-line `<text>` from stdin if no positional is given.

**State files** in `$METRO_STATE_DIR` (default `~/.cache/metro`):
- `AGENTS.md` — agent skill copied from the package on every start (so the path is stable across upgrades)
- `history.jsonl` — universal message log (one JSON object per line; append-only). Read with `metro history`. Each entry carries `from` and `to` as universal participant URIs (`metro://<station>/user/<id>`, `metro://claude/user/<orgId>`, `metro://codex/user/<accountId>`) plus a `fromName` display field. The dispatcher auto-detects the consuming agent for `to` on inbound (`$CLAUDECODE` → `metro://claude/user/<orgId>` from `claude auth status --json`; `$METRO_CODEX_RC`/`$CODEX_HOME` → `metro://codex/user/<accountId>` from `$CODEX_HOME/auth.json`).
- `bot-ids.json` — `{discord: "<botUserId>", telegram: "<botUserId>"}` written by the daemon on startup (cached for the few historical lookups that still need a bot identity).
- `lines.json` — line → last-seen / name cache (read by `metro lines`)
- `agent-registry.json` — every `(station, agent-id, sessions[])` tuple metro has seen; surfaced under each agent row in `metro stations`
- `stations/codex/session-id` — current codex-rc thread id (daemon writes on handshake; CLI processes read for `metro://codex/<agent-id>/<session>`)
- `webhooks.json` — registered HTTP receive endpoints (id, label, optional shared secret)
- `tunnel.json` — Cloudflare named-tunnel config (`{name, hostname}`); when present, the daemon spawns `cloudflared tunnel run`
- `.tail-lock` — dispatcher pid
- `metro.sock` — daemon IPC socket
- `telegram-offset.json` — last processed update id

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN`, `DISCORD_BOT_TOKEN` | — | Bot tokens. `metro setup` writes them here. |
| `METRO_CODEX_RC` | — | Codex app-server URL (`ws://…`, `wss://…`, `unix:///…`). When set, the daemon pushes each event via JSON-RPC `turn/start`. |
| `METRO_WEBHOOK_PORT` | `8420` | Local port the HTTP webhook listener binds to (always `127.0.0.1`; expose publicly via Cloudflare tunnel). |
| `METRO_AGENT_ID` | — | Override the resolved agent id (orgId / accountId) used in `metro://<station>/user/<id>` and `metro://<station>/<id>/<session>`. Useful for testing. |
| `METRO_AGENT_SESSION_ID` | — | Override the resolved session id (Claude session / Codex thread). |
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
- [`src/stations/`](src/stations/) — Line URI scheme + ChatStation interface + listing ([`index.ts`](src/stations/index.ts)). Chat impls: [`discord.ts`](src/stations/discord.ts), [`telegram.ts`](src/stations/telegram.ts) (+ [`telegram-md.ts`](src/stations/telegram-md.ts) markdown helper). Agent identity resolvers: [`claude.ts`](src/stations/claude.ts) (orgId via `claude auth status --json`), [`codex.ts`](src/stations/codex.ts) (account_id via `auth.json`). HTTP receive: [`webhook.ts`](src/stations/webhook.ts).
- [`src/codex-rc.ts`](src/codex-rc.ts) — Codex app-server WebSocket push client (also exposes the rc thread id used as Codex session-id).
- [`src/tunnel.ts`](src/tunnel.ts) — Cloudflared named-tunnel supervisor.
- [`src/webhooks.ts`](src/webhooks.ts) — webhook endpoint store (`webhooks.json` CRUD).
- [`src/registry.ts`](src/registry.ts) — agent registry: `(station, agent-id, sessions[])` tracking.
- [`src/history.ts`](src/history.ts) — universal message log + `agentSelf()` / `selfLine()` identity helpers.
- [`src/ipc.ts`](src/ipc.ts) — Unix-socket IPC between the daemon and one-shot CLI commands.
- [`src/cache.ts`](src/cache.ts) — in-memory line cache with debounced flush to `lines.json`, plus bot-id cache.
- [`docs/uri-scheme.md`](docs/uri-scheme.md) specs the Line format; [`docs/agents.md`](docs/agents.md) is the in-context skill for agents.

CI runs typecheck + lint + build on every PR via [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

---

## Caveats

- **No allowlist on chat stations.** Anyone who can DM/`@`-mention your bot can produce events. Run against bots you own.
- **Webhook secrets are optional but recommended.** Without `--secret`, anyone who learns the endpoint URL can POST events. With it, metro verifies `X-Hub-Signature-256` and rejects mismatches.
- **Telegram bot privacy is on by default**, which can block `@`-mentions in groups. Disable via [@BotFather](https://t.me/BotFather) → Bot Settings → Group Privacy, then kick + re-invite.
- **Telegram non-forum groups are skipped.** No thread boundary to scope on. DMs and forum topics work normally.
- **Telegram fetch isn't supported** (bot API doesn't expose history); `metro fetch` returns `[]` on Telegram lines.
- **Cloudflared is your responsibility.** `metro tunnel setup` records the named tunnel; you still install `cloudflared` (`brew install cloudflared`) and run `cloudflared tunnel login` once.

---

## Uninstall

```bash
metro setup clear
rm -rf ~/.cache/metro
npm uninstall -g @stage-labs/metro
```
