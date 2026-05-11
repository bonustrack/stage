# Metro

Run a long-lived daemon that bridges Discord, Telegram, and GitHub mentions to your Codex + Claude Code agents. Each chat thread / topic / issue gets its own agent session with streaming responses and inline, persistent tool-call traces. Both agents run side-by-side — pick per-message with a `with claude` / `with codex` suffix.

## Prereqs

- **Node ≥ 22** (or Bun ≥ 1.3).
- **One or both agent CLIs** installed and authenticated:
  - **Claude Code** — run `claude` once interactively to log in. Metro shells out per turn and inherits your auth, plugins, settings.
  - **Codex** — run `codex` once interactively to log in. Metro spawns `codex app-server` and inherits your auth, MCPs, sandboxing.
- **Discord bot** (optional) with **Message Content Intent** enabled (Developer Portal → Bot → Privileged Gateway Intents).
- **Telegram bot** (optional). In supergroup forums, the bot also needs the **Manage Topics** admin permission so it can auto-create topics on @-mention.
- **GitHub mention bridge** (optional). Requires a public URL for the webhook (smee.io / cloudflared / ngrok for local dev) and a GitHub token with `issues:write` so the bot can reply on the issue/PR.

## Quickstart

```bash
npm install -g @stage-labs/metro@beta    # or: bun add -g @stage-labs/metro@beta

metro setup discord <token>              # https://discord.com/developers/applications
metro setup telegram <token>             # https://t.me/BotFather

metro doctor                             # verify
metro stations                           # list stations + capabilities
metro                                    # run the dispatcher
```

Metro starts both agents at boot and listens on whichever stations are configured. Each line defaults to **Claude** for the first turn; once you've used an agent there, follow-up messages stick with it. Switch per-message by suffixing `with claude` or `with codex` (any casing):

```
@Metro draft a release note
   → uses Claude (default for a new line)

How would Codex have done this? with codex
   → routes this turn to Codex; stays Codex on subsequent turns
```

### Discord

@-mention the bot in any channel:
1. Metro creates a thread anchored on your message (named after the message).
2. Spins up an agent session for that thread.
3. Streams the agent's reply with each tool call as its own block: plain header `🛠 **Read**` followed by two fenced code blocks — input (`src/foo.ts`) above, output (file contents) below. Outputs are capped at 50 lines / 1500 chars per tool with a `_(N more lines)_` note if truncated. `Thinking…` shows as a transient status that vanishes once real content arrives.

Follow-ups in the thread route automatically — no @-mention needed.

### Telegram

- **DM the bot** — every message is implicitly addressed to it; one line per chat.
- **@-mention the bot in a forum supergroup's General topic** — metro auto-creates a new topic for the conversation (Discord-style "thread from message") and posts a deep link back in General so the new topic is one tap away. Subsequent messages in that topic route automatically.
- **Inside an existing custom topic** — routes to that topic's line on every message.

Regular (non-forum) groups are not routed — they have no thread boundary.

### GitHub mentions (optional)

Mention the bot's configured GitHub user in an **issue body, issue comment, PR body, or PR comment** in any repo that points its webhook at metro — the agent answers as a comment on the same issue/PR, with full turn streaming via comment edits. Each issue/PR gets its own agent session that persists across follow-up mentions.

Set up:
1. Pick a GitHub user the bot will listen for (a real account or a bot account) and generate a token for it with `issues:write` (and `pull_requests:write` for PR comments).
2. Set env vars:
   ```
   GITHUB_WEBHOOK_SECRET=...           # any strong random string
   GITHUB_BOT_USERNAME=metrobot        # the @-handle metro should react to
   GITHUB_TOKEN=ghp_...                # the bot's PAT / fine-grained token
   METRO_GITHUB_PORT=4321              # optional, default 4321
   ```
3. In your repo's *Settings → Webhooks*: payload URL pointing at your public endpoint + `/webhook`, content type `application/json`, the same secret, events: **Issues**, **Issue comments**.
4. For local dev, tunnel the webhook in: `npx smee-client --target http://localhost:4321/webhook --url <your-smee-url>` (use the smee URL as the payload URL in step 3).

## Architecture

Metro is built on two interfaces:

- **`Station`** — anything that exchanges messages with the dispatcher. Each station declares its **capabilities** (`in`/`out` modalities, features like `stream`, `edit`, `tools`, `cancel`, `attachments`).
  - **`AgentStation`** — Claude, Codex. Takes a `TurnRequest`, yields an `AsyncIterable<TurnEvent>` (`delta` / `tool-start` / `tool-end`). Cancellation via `AbortSignal`.
  - **`ChatStation<TMeta>`** — Discord, Telegram, GitHub. Receives `InboundMessage`, posts via `send` / `edit`. Typed `meta` carries platform-specific extras (`inGuild`, `inForum`, `isPR`, etc.).
- **`Line`** — a URI-shaped scope identifier: `metro://<station>/<path>`. See [`docs/uri-scheme.md`](docs/uri-scheme.md). Every persistent on-disk identifier is a Line.

```
Discord gateway ──┐
Telegram poller ──┤                          ┌─▶ codex station   (long-lived `codex app-server`, UDS JSON-RPC)
GitHub webhook ───┼─▶ metro dispatcher ──────┤
                  │                          └─▶ claude station  (per-turn `claude -p`, stream-json)
                  └─── Line→thread map (scopes.json)
```

Adding a new chat backend (Slack, Matrix, SMS, …) is `class XStation implements ChatStation` plus a `Line.x(...)` helper — the dispatcher picks it up polymorphically.

## How it works

- **One metro = one daemon.** Lockfile at `$METRO_STATE_DIR/.tail-lock` keeps things singleton.
- **Both agents side-by-side.** A line can have up to one session per agent — independent histories. Routing is per-message: explicit `with claude` / `with codex` suffix, otherwise the line's last-used agent, otherwise Claude.
- **Streaming.** Replies edit one message every ~1500 ms while deltas stream in (leading-edge first flush for fast initial feedback). Long replies split past ~1900 chars onto a follow-up message.
- **Tool-call visibility.** Each tool call is rendered as a plain `🛠 **<tool>**` header plus two fenced code blocks — input then output — paired by tool id so parallel calls don't collide. Both blocks are fully visible (no collapse). Outputs are capped at 50 lines / 1500 chars per tool.
- **Image attachments.** Discord and Telegram image uploads are downloaded and forwarded to the agent as a vision-input content block (Anthropic-format `image/base64` for Claude; `image_url` data URI for Codex). 20 MB cap per file; non-image attachments still surface as `[file: name]` text.
- **Telegram formatting.** Agent markdown (`**bold**`, `*italic*`, `` `code` ``, fenced blocks, `[link](url)`, blockquotes) is converted to Telegram's HTML parse mode on the way out, so it renders as formatted text instead of literal characters.
- **No link previews.** Outgoing messages set `link_preview_options.is_disabled` on Telegram and the `SUPPRESS_EMBEDS` flag on Discord, so URLs in agent replies don't unfurl into giant auto-embeds.
- **Stop button.** While an agent turn is in flight, the streamed message carries an `⏹ Stop` button (Discord component / Telegram inline keyboard). Tapping it triggers the turn's `AbortSignal` — Claude via SIGTERM on the `claude -p` subprocess; Codex via `turn/interrupt` on app-server — and removes the button on the next flush.
- **GitHub mentions.** When the bot's configured GitHub user is `@`-mentioned in an issue/PR body or comment, the HMAC-verified webhook allocates a per-issue agent session and the agent replies as a GitHub comment, streaming via `PATCH /issues/comments`. Follow-up mentions on the same issue continue the same session.
- **Queueing.** Messages that arrive while a turn is running are buffered per-line and answered together in the next reply.
- **Catchup-on-restart.** Discord uses a per-line `lastSeenMessageId` watermark and REST-fetches anything newer when metro comes back up. Telegram leans on its own update-id queue (persisted offset in `telegram-offset.json`).

## Config

| Variable | Default | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN`, `DISCORD_BOT_TOKEN` | — | Bot tokens. `metro setup` writes them here. |
| `METRO_CONFIG_DIR` | `~/.config/metro` | Where the global `.env` lives. |
| `METRO_STATE_DIR` | `~/.cache/metro` | Lockfile, line cache, codex socket, telegram offset, claude session set. |
| `METRO_LOG_LEVEL` | `info` | `trace` / `debug` / `info` / `warn` / `error` / `fatal`. |
| `GITHUB_WEBHOOK_SECRET` + `GITHUB_BOT_USERNAME` + `GITHUB_TOKEN` | — | Enable GitHub mention support (see GitHub section). Webhook listens on `METRO_GITHUB_PORT` (default `4321`). The token needs `issues:write` (+ `pull_requests:write` for PR comments). |

Token precedence: process env → `./.env` → `$METRO_CONFIG_DIR/.env`. Logs to stderr.

## Develop locally

```bash
git clone https://github.com/bonustrack/metro && cd metro
bun install && bun run build
bun link                                 # makes `metro` resolve to this checkout
METRO_LOG_LEVEL=debug metro
```

Architecture docs: [`docs/uri-scheme.md`](docs/uri-scheme.md). Add a new chat backend in `src/stations/<name>/index.ts` implementing `ChatStation` (see [`src/stations/types.ts`](src/stations/types.ts)).

## Reference

- `metro --help` — command surface
- `metro doctor` — health check (tokens + gateway/poller reachability + dispatcher status)
- `metro stations` — list known stations with their capability matrix and config status
- State files (`$METRO_STATE_DIR`, defaults to `~/.cache/metro/`):
  - `scopes.json` — `Line → agent-session` map (keys are `metro://<station>/<path>` URIs)
  - `.tail-lock` — dispatcher pid
  - `codex-app-server.sock` — codex's UDS
  - `telegram-offset.json` — last processed update id (used for catchup on restart)
  - `claude-sessions.json` — set of started Claude session uuids (so restarts use `--resume` instead of `--session-id`)

## Uninstall

```bash
metro setup clear
rm -rf ~/.cache/metro/
npm uninstall -g @stage-labs/metro
```

## Caveats

- **No allowlist.** Anyone who can DM/@-mention your bot can spawn an agent session. Run against bots you own.
- **Per-agent histories are separate.** Switching with `with codex` mid-line spins up a fresh Codex session — it has no idea what you discussed with Claude in the same line. Each agent only sees what was sent to it.
- **One agent missing is OK.** If only `claude` or only `codex` is installed/authenticated, metro still starts; messages asking for the missing one surface an error in chat.
- **Telegram non-forum groups are skipped.** Without a per-topic thread boundary the routing model breaks down. DMs and forum topics (incl. auto-created ones from General) work normally.
- **Telegram bot privacy.** Default Telegram bot privacy is *enabled*, which can block group messages even with @-mentions. Disable in [@BotFather](https://t.me/BotFather) → Bot Settings → Group Privacy → Turn off, then kick + re-invite the bot.
- **GitHub bridge needs a public URL.** The webhook receiver listens locally; GitHub posts to it from the public internet. Use smee.io / cloudflared / ngrok for dev. Every request is HMAC-verified, so a leaked URL only lets attackers spam rejected POSTs (cheap to ignore), but make sure `GITHUB_WEBHOOK_SECRET` is high-entropy.
- **Line URIs are not migrated across upgrades.** Pre-1.0: older `discord:ID` / `telegram:CHAT:TOPIC` keys in `scopes.json` are ignored on first run after upgrade.
