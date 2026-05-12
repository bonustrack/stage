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
| `github`   | chat  | text          | edit                                | `METRO_TOKEN` + `GITHUB_BOT_USERNAME` + `GITHUB_TOKEN` + Action  |

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
```

Lines map 1:1 to agent sessions in `scopes.json`. Anyone can post to a line via [`metro send`](#cli) — daemon optional. Full grammar in [`docs/uri-scheme.md`](docs/uri-scheme.md).

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

GitHub events reach metro via a **GitHub Action** in the target repo — no webhook configuration, no HMAC secret. The Action forwards the event payload over HTTP to your running daemon. See [Testing GitHub](#testing-github) for the end-to-end recipe; the workflow template is at [`docs/github-action.yml`](docs/github-action.yml).

Required env on the daemon:

```
METRO_TOKEN=<random>               # shared secret with the Action
GITHUB_BOT_USERNAME=<github user>  # whose @-mentions trigger the bot
GITHUB_TOKEN=<PAT>                 # issues:write (+ pull_requests:write for PRs)
METRO_PORT=4321                    # optional, default 4321
```

The daemon needs a public URL (cloudflared / ngrok / smee) so the Action can reach it.

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
| `METRO_TOKEN`, `GITHUB_BOT_USERNAME`, `GITHUB_TOKEN` | — | Enables GitHub. `METRO_TOKEN` is the shared secret with the Action workflow. `GITHUB_TOKEN` needs `issues:write` (+ `pull_requests:write` for PR comments). Daemon listens on `METRO_PORT` (default `4321`). |
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
metro lines                                 List active conversations (sorted by recency, with names).
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

Source map:

- [`src/cli/`](src/cli/) — the `metro` binary entry ([`cli/index.ts`](src/cli/index.ts)) plus subcommand handlers (`lines.ts`, `update.ts`).
- [`src/dispatcher.ts`](src/dispatcher.ts) — the daemon: wires stations together, routes inbounds, installs `AGENTS.md` into state on each start.
- [`src/stations/`](src/stations/) — one folder per station (`claude/`, `codex/`, `discord/`, `github/`, `telegram/`) plus the shared `types.ts`, `line.ts`, `listing.ts`, `send.ts`.
- [`src/helpers/`](src/helpers/) — `streaming.ts`, `turn.ts`, `scope-cache.ts`, `async-queue.ts`.
- [`docs/uri-scheme.md`](docs/uri-scheme.md) specs the Line format; [`docs/agents.md`](docs/agents.md) is the in-context skill copied to `$METRO_STATE_DIR/AGENTS.md`.

CI runs typecheck + lint + build on every PR via [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

---

## Testing GitHub

1. **Generate a PAT** (the bot acts as this user; for testing your own account is fine):
   - **Fine-grained** at `github.com/settings/tokens?type=beta` — scoped to a test repo with **Issues: Read & write** (+ **Pull requests: Read & write**). Works for *your* repos; for org repos the org admin must enable fine-grained PATs.
   - **Classic** at `github.com/settings/tokens?type=classic` with the `repo` scope. Works for any repo you have access to, no org opt-in needed.
2. **Set env vars** in `~/.config/metro/.env`:
   ```bash
   export METRO_TOKEN="$(openssl rand -hex 32)"
   export GITHUB_BOT_USERNAME="metrobot"   # see solo-testing note below
   export GITHUB_TOKEN="ghp_..."
   ```
3. **Get a public URL** for the daemon. Easiest, free, single command:
   ```bash
   cloudflared tunnel --url http://localhost:4321
   # → https://<random>.trycloudflare.com
   ```
   Or use ngrok / smee — anything that exposes port `4321`.
4. **Drop the workflow** into your test repo at `.github/workflows/metro.yml` (copy [`docs/github-action.yml`](docs/github-action.yml) — replace `metrobot` in the `if:` filter with your `GITHUB_BOT_USERNAME`).
5. **Add two repo secrets** (*Settings → Secrets and variables → Actions*):
   - `METRO_URL` — the cloudflared/ngrok URL from step 3
   - `METRO_TOKEN` — the same value you set in `.env`
6. **Run metro**: `METRO_LOG_LEVEL=debug metro` — look for `github station: listening for /dispatch`.
7. **Open an issue** with body `@metrobot what does this repo do?` — within ~10s the bot comments back (as the token's owner).

**Solo testing note.** Metro filters self-mentions (`sender === bot`) to prevent reply loops. If `GITHUB_BOT_USERNAME` equals your own username and you `@yourself`, the filter drops the event — you can't trigger the bot alone. Workaround: use a pseudo-name like `metrobot` (doesn't need to be a real GitHub user — it's just the string the regex matches in issue bodies). The bot still replies as the token owner.

**Common gotchas:**
- Action run fails with `401 bad token` → `METRO_TOKEN` mismatch between repo secret and `.env`.
- Action run succeeds, daemon logs nothing → `GITHUB_BOT_USERNAME` doesn't appear in the body verbatim (case-sensitive); or the workflow `if:` filter is screening it out.
- Action run fails to reach the daemon → tunnel down, or `METRO_URL` secret has a trailing slash / path; should be the bare origin, metro appends `/dispatch`.
- Bot replies but token rejected when posting → `GITHUB_TOKEN` lacks `issues:write`; regenerate with `repo` (classic) or full Issues/PRs write (fine-grained).

---

## Caveats

- **No allowlist.** Anyone who can DM/`@`-mention your bot can spawn a session. Run against bots you own.
- **Per-agent histories are separate.** `with codex` mid-line starts a fresh Codex session; it doesn't see what Claude saw, and vice versa.
- **Telegram non-forum groups are skipped.** No thread boundary to scope on. DMs and forum topics work normally.
- **Telegram bot privacy is on by default**, which can block `@`-mentions in groups. Disable via [@BotFather](https://t.me/BotFather) → Bot Settings → Group Privacy, then kick + re-invite.
- **GitHub needs a public URL.** The Action posts events to your daemon over the internet. Authentication is a shared bearer token (`METRO_TOKEN`) — use a high-entropy value, since a leak would let anyone synthesize fake events.
- **Pre-1.0 line URIs aren't migrated.** Older `discord:ID` / `telegram:CHAT:TOPIC` keys in `scopes.json` are ignored after upgrade.

---

## Uninstall

```bash
metro setup clear
rm -rf ~/.cache/metro
npm uninstall -g @stage-labs/metro
```
