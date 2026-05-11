# Metro

> **Bridge Discord, Telegram, and GitHub to Claude Code + Codex.**

Metro is a small daemon that turns any chat thread, forum topic, or GitHub issue into a live conversation with your local coding agents. Each thread is its own agent session — Claude and Codex run side-by-side, replies stream in real time with tool calls visible inline, and you can stop a turn with one click.

```
[Discord — #infra]

less        @bot we got a 5xx spike from /v1/sync. Look?
sandboxbot  > 🛠 Bash  git log --since=24h --oneline
            > 🛠 Read  services/sync.ts

            Three deploys in the last 24h. The 14:02 one swallows a
            timeout into a 500 on line 47 instead of retrying. Want
            me to open a PR?

            [ ⏹ Stop ]
```

---

## Quickstart

```bash
npm install -g @stage-labs/metro@beta    # or: bun add -g @stage-labs/metro@beta

metro setup discord <token>              # https://discord.com/developers/applications
metro setup telegram <token>             # https://t.me/BotFather
metro doctor                             # verify
metro                                    # run the dispatcher
```

Requires **Node ≥ 22 or Bun ≥ 1.3** and at least one of [Claude Code](https://claude.com/claude-code) or [Codex](https://github.com/openai/codex) installed and logged in (run them once interactively first; metro inherits your auth).

In **Discord**: DM the bot, or `@<bot>` in any channel. In **Telegram**: DM, or `@<bot>` in a forum's General topic. In **GitHub**: see [Testing GitHub](#testing-github).

---

## Stations

Everything in metro is a **station** with declared capabilities:

| Station    | Kind  | Modalities    | Features                            | Config                                                            |
|------------|-------|---------------|-------------------------------------|-------------------------------------------------------------------|
| `claude`   | agent | text + image  | stream, tools, cancel, attachments  | `claude` CLI on PATH, logged in                                   |
| `codex`    | agent | text + image  | stream, tools, cancel, attachments  | `codex` CLI on PATH, logged in                                    |
| `discord`  | chat  | text + image  | stream, edit, attachments           | `DISCORD_BOT_TOKEN` + Message Content Intent                      |
| `telegram` | chat  | text + image  | stream, edit, attachments           | `TELEGRAM_BOT_TOKEN` + Manage Topics admin (for forums)           |
| `github`   | chat  | text          | edit                                | `GITHUB_WEBHOOK_SECRET` + `GITHUB_BOT_USERNAME` + `GITHUB_TOKEN`  |

Run `metro stations` to see the same matrix with live config status (`✓` configured, `✗` not).

Each chat platform behaves slightly differently — what's universal is captured by the capabilities; the rest is in [Conversations](#conversations).

---

## Lines

Every conversational scope is identified by a **Line** — a URI in the form `metro://<station>/<path>`:

```
metro://discord/1234567890123456789
metro://telegram/-1001234567890                 # main chat / DM
metro://telegram/-1001234567890/42              # forum topic 42
metro://github/bonustrack/metro/issues/123      # GitHub issue
metro://github/bonustrack/metro/pull/456        # GitHub PR
metro://claude/01933f7a-12b4-7c01-...           # agent thread (internal)
```

Lines are the unit of routing: the line maps 1:1 to an agent session in `scopes.json`. Anyone can post to a line via [`metro send`](#cli) — daemon optional. Full grammar in [`docs/uri-scheme.md`](docs/uri-scheme.md).

---

## Conversations

### Discord

- **DM the bot** — every message is implicit; one line per DM.
- **`@<bot>` in any guild channel** — metro creates a thread from your message, allocates an agent session, and streams the reply. Follow-ups in the thread route automatically.
- **Tool calls** — render as `🛠 <tool>` headers plus two fenced code blocks (input → output). Outputs cap at 50 lines / 1500 chars with a `_(N more lines)_` note when truncated. Parallel tool calls are paired by id and don't collide.
- **Stop button** — every in-flight turn carries an `⏹ Stop` button that aborts the underlying subprocess (Claude via `SIGTERM`, Codex via `turn/interrupt`).
- **Catchup on restart** — Discord uses a per-line `lastSeenMessageId` watermark; metro REST-fetches anything newer when it comes back up.

### Telegram

- **DM the bot** — implicit; one line per chat.
- **`@<bot>` in a forum supergroup's General topic** — metro creates a new forum topic for the conversation and posts a deep link back in General so it's one tap away. Follow-ups in that topic route automatically.
- **Inside an existing custom topic** — routes to that topic's line on every message.
- **Markdown → Telegram HTML** — agent markdown (`**bold**`, `*italic*`, `` `code` ``, fences, `[link](url)`, blockquotes) is converted on the way out. Plain-text fallback if Telegram rejects the HTML.

Regular (non-forum) groups are skipped — without a per-thread boundary the routing model breaks down.

### GitHub

`@<bot-user>` in an **issue body, issue comment, PR body, or PR comment** allocates a per-issue agent session and the bot replies as a comment on the same issue/PR. Streaming is simulated via `PATCH /issues/comments` edits to the bot's own comment. Each issue/PR holds its own session across follow-ups.

Setup:

```
GITHUB_WEBHOOK_SECRET=<random>     # any high-entropy string
GITHUB_BOT_USERNAME=<github user>  # whose @-mentions trigger the bot
GITHUB_TOKEN=<PAT>                 # issues:write (+ pull_requests:write for PRs)
METRO_GITHUB_PORT=4321             # optional, default 4321
```

In your repo's *Settings → Webhooks*: payload URL `https://<your-public-url>/webhook`, content type `application/json`, the secret matches `GITHUB_WEBHOOK_SECRET`, events: **Issues** + **Issue comments**. For local development tunnel with [smee.io](https://smee.io), [cloudflared](https://github.com/cloudflare/cloudflared), or [ngrok](https://ngrok.com).

End-to-end recipe: [Testing GitHub](#testing-github).

---

## Agents

Both agents run side-by-side at boot. Each line defaults to **Claude** for the first turn; once you've used an agent in a line, it sticks. Switch per-message with a `with claude` / `with codex` suffix:

```
@bot draft a release note
   → uses Claude (default for a new line)

How would Codex have done this? with codex
   → routes this turn to Codex; the line stays Codex on follow-ups
```

A line can hold one session per agent — independent histories — so switching back later resumes where that agent left off. If only one agent is installed, metro still starts and asks-for-the-missing-one error inline.

---

## Cross-station relay

Agents can post to any line through the CLI:

```bash
metro send metro://telegram/-1001234567890/42 "patch deployed"
metro send metro://github/bonustrack/metro/issues/1 "all clear"
```

`metro send` uses the same env tokens as the dispatcher and doesn't require the daemon — useful when an agent in one place needs to relay to another.

---

## Architecture

```
Discord gateway ──┐
Telegram poller ──┤                          ┌─▶ codex station   (long-lived `codex app-server`, UDS JSON-RPC)
GitHub webhook ───┼─▶ metro dispatcher ──────┤
                  │                          └─▶ claude station  (per-turn `claude -p`, stream-json)
                  └─── line → agent-thread map (`scopes.json`)
```

The codebase is built on a small protocol in [`src/stations/types.ts`](src/stations/types.ts):

- **`Station`** — name, capabilities, `start`/`stop` lifecycle.
  - **`AgentStation`** — `createThread()`, `sendTurn(req)` returns an `AsyncIterable<TurnEvent>` of `delta` / `tool-start` / `tool-end`. Cancellation via `AbortSignal`.
  - **`ChatStation<TMeta>`** — `onMessage`/`onStop` event hooks, `send`/`edit` for posting back. Typed meta carries platform extras (`inGuild`, `inForum`, `isPR`, …).
- **`Line`** — branded URI string. Each station owns its parse/format helpers in [`src/stations/line.ts`](src/stations/line.ts).

Adding a backend (Slack, Matrix, SMS, another LLM) = `class XStation implements ChatStation` + a `Line.x(...)` helper. The dispatcher picks it up polymorphically.

Behaviors worth knowing:
- **One daemon per machine.** Lockfile at `$METRO_STATE_DIR/.tail-lock` enforces singleton.
- **Streaming.** Replies edit one message every ~1500 ms while deltas arrive (leading-edge first flush so feedback feels instant). Long replies split past ~1900 chars onto follow-up messages.
- **No link previews.** Outgoing messages set `link_preview_options.is_disabled` on Telegram and `SUPPRESS_EMBEDS` on Discord so URLs don't unfurl.
- **Image attachments.** Discord and Telegram image uploads are forwarded as vision inputs (Anthropic `image/base64` for Claude; `image_url` data URI for Codex). 20 MB cap; non-images surface as `[file: name]` text.
- **In-flight queueing.** Messages arriving during a turn are buffered per-line and answered as one combined follow-up.

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN`, `DISCORD_BOT_TOKEN` | — | Bot tokens. `metro setup` writes them here. |
| `GITHUB_WEBHOOK_SECRET`, `GITHUB_BOT_USERNAME`, `GITHUB_TOKEN` | — | Enables GitHub. Token needs `issues:write` (+ `pull_requests:write` for PR comments). Webhook listens on `METRO_GITHUB_PORT` (default `4321`). |
| `METRO_CONFIG_DIR` | `~/.config/metro` | Where the global `.env` lives. |
| `METRO_STATE_DIR` | `~/.cache/metro` | Lockfile, line cache, codex socket, telegram offset, claude session set. |
| `METRO_LOG_LEVEL` | `info` | `trace` / `debug` / `info` / `warn` / `error` / `fatal`. |

Precedence: process env → `./.env` → `$METRO_CONFIG_DIR/.env`. Logs go to stderr.

---

## CLI

```
metro                                       Run the dispatcher daemon.
metro setup [telegram|discord <token>]      Save token, or show status.
metro setup clear [telegram|discord|all]    Remove tokens.
metro doctor                                Health check.
metro stations                              List stations + capabilities.
metro lines                                 List active conversations (sorted by recency).
metro send <line> <text>                    Post to any metro:// line.
metro update                                Upgrade in place.
```

All commands accept `--json` for machine-readable output.

**State files** in `$METRO_STATE_DIR`:
- `scopes.json` — Line → agent-session map
- `AGENTS.md` — skill doc copied from the package on every dispatcher start; surfaced into each agent's per-turn context so it knows about `metro lines` / `metro send` / `metro stations`
- `.tail-lock` — dispatcher pid
- `codex-app-server.sock` — codex Unix socket
- `telegram-offset.json` — last processed update id
- `claude-sessions.json` — known Claude session uuids (so restarts use `--resume`)

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

Source map: [`src/dispatcher.ts`](src/dispatcher.ts) is the entry; [`src/stations/`](src/stations/) holds each station's folder; [`src/helpers/`](src/helpers/) has the streaming/turn/scope-cache utilities; [`docs/uri-scheme.md`](docs/uri-scheme.md) specs the Line format.

---

## Testing GitHub

1. **Pick a GitHub user** the bot acts as (your own account works) and generate a fine-grained PAT scoped to a test repo with **Issues: Read & write** (+ **Pull requests: Read & write** for PR comments).
2. **Set env vars**:
   ```bash
   export GITHUB_WEBHOOK_SECRET="$(openssl rand -hex 32)"
   export GITHUB_BOT_USERNAME="your-github-user"
   export GITHUB_TOKEN="ghp_..."
   ```
3. **Tunnel** your local webhook port to the internet:
   ```bash
   npx smee-client --target http://localhost:4321/webhook --url <https://smee.io/your-channel>
   ```
4. **Add a webhook** on the test repo (*Settings → Webhooks*): payload URL = the smee channel, content type `application/json`, the same secret, events **Issues** + **Issue comments**.
5. **Run metro**: `METRO_LOG_LEVEL=debug metro` — you should see `github station: listening`.
6. **Open an issue** with body `@<bot-user> hello, what's this repo?` — the bot comments back.

**Common gotchas:**
- Webhook 401 → secret mismatch.
- Webhook 200 but no reply → token lacks `issues:write`, or `GITHUB_BOT_USERNAME` ≠ the user whose token you're using.
- Bot replies to its own comments → `GITHUB_BOT_USERNAME` must exactly match the commenting user (`sender === bot` is what stops the loop).

---

## Caveats

- **No allowlist.** Anyone who can DM/`@`-mention your bot can spawn a session. Run against bots you own.
- **Per-agent histories are separate.** `with codex` mid-line starts a fresh Codex session; it doesn't see what Claude saw, and vice versa.
- **Telegram non-forum groups are skipped.** No thread boundary to scope on. DMs and forum topics work normally.
- **Telegram bot privacy is on by default**, which can block `@`-mentions in groups. Disable via [@BotFather](https://t.me/BotFather) → Bot Settings → Group Privacy, then kick + re-invite.
- **GitHub needs a public URL.** Webhooks are HMAC-verified, so a leaked URL only lets attackers spam rejected POSTs — but use a high-entropy `GITHUB_WEBHOOK_SECRET`.
- **Pre-1.0 line URIs aren't migrated.** Older `discord:ID` / `telegram:CHAT:TOPIC` keys in `scopes.json` are ignored after upgrade.

---

## Uninstall

```bash
metro setup clear
rm -rf ~/.cache/metro
npm uninstall -g @stage-labs/metro
```
