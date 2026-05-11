# Metro

Run a long-lived daemon that bridges Discord and Telegram to your Codex + Claude Code agents. Each chat thread/topic gets its own agent session with streaming responses and inline, persistent tool-call traces. Both agents run side-by-side — pick per-message with a `with claude` / `with codex` suffix.

## Prereqs

- **Node ≥ 22** (or Bun ≥ 1.3).
- **One or both agent CLIs** installed and authenticated:
  - **Claude Code** — run `claude` once interactively to log in. Metro shells out per turn and inherits your auth, plugins, settings.
  - **Codex** — run `codex` once interactively to log in. Metro spawns `codex app-server` and inherits your auth, MCPs, sandboxing.
- **Discord bot** (optional) with **Message Content Intent** enabled (Developer Portal → Bot → Privileged Gateway Intents).
- **Telegram bot** (optional). In supergroup forums, the bot also needs the **Manage Topics** admin permission so it can auto-create topics on @-mention.

## Quickstart

```bash
npm install -g @stage-labs/metro@beta    # or: bun add -g @stage-labs/metro@beta

metro setup discord <token>              # https://discord.com/developers/applications
metro setup telegram <token>             # https://t.me/BotFather

metro doctor                             # verify
metro                                    # run the orchestrator
```

Metro starts both agents at boot and listens on whichever platforms are configured. Each scope defaults to **Claude** for the first turn; once you've used an agent there, follow-up messages stick with it. Switch per-message by suffixing `with claude` or `with codex` (any casing):

```
@Metro draft a release note
   → uses Claude (default for a new scope)

How would Codex have done this? with codex
   → routes this turn to Codex; stays Codex on subsequent turns
```

### Discord

@-mention the bot in any channel:
1. Metro creates a thread anchored on your message (named after the message).
2. Spins up an agent session for that thread.
3. Streams the agent's reply with each tool call kept inline (`> 🛠 **Read** `src/foo.ts``, `> 🛠 **Bash** `ls -la``, …) — the tool's output is folded into the same blockquote (collapsible `<blockquote expandable>` on Telegram; truncated inline on Discord). `Thinking…` shows as a transient status that vanishes once real content arrives.

Follow-ups in the thread route automatically — no @-mention needed.

### Telegram

- **DM the bot** — every message is implicitly addressed to it; one scope per chat.
- **@-mention the bot in a forum supergroup's General topic** — metro auto-creates a new topic for the conversation (Discord-style "thread from message") and posts a deep link back in General so the new topic is one tap away. Subsequent messages in that topic route automatically.
- **Inside an existing custom topic** — routes to that topic's scope on every message.

Regular (non-forum) groups are not routed — they have no thread boundary.

## How it works

```
Discord gateway ──┐                       ┌─▶ codex app-server   (long-lived subprocess, UDS JSON-RPC)
                  ├─▶ metro orchestrator ─┤
Telegram poller ──┘                       └─▶ claude -p ...      (per-turn subprocess, stream-json)
                            │
                            └──── scope map (scopes.json)
```

- **One metro = one daemon.** Lockfile at `$METRO_STATE_DIR/.tail-lock` keeps things singleton.
- **Both agents side-by-side.** A scope can have up to one session per agent — independent histories. Routing is per-message: explicit `with claude` / `with codex` suffix, otherwise the scope's last-used agent, otherwise Claude.
- **Streaming.** Replies edit one message every ~1500 ms while deltas stream in (leading-edge first flush for fast initial feedback). Tool calls land inline as quoted bullets (`> 🛠 **<tool>** \`<arg>\``) so the full agent trail stays in scroll-back; long replies split past ~1900 chars onto a follow-up message.
- **Telegram formatting.** Agent markdown (`**bold**`, `*italic*`, `` `code` ``, fenced blocks, `[link](url)`, blockquotes) is converted to Telegram's HTML parse mode on the way out, so it renders as formatted text instead of literal characters.
- **Queueing.** Messages that arrive while a turn is running are buffered per-scope and answered together in the next reply.
- **Catchup-on-restart.** Discord uses a per-scope `lastSeenMessageId` watermark and REST-fetches anything newer when metro comes back up. Telegram leans on its own update-id queue (persisted offset in `telegram-offset.json`).

## Config

| Variable | Default | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN`, `DISCORD_BOT_TOKEN` | — | Bot tokens. `metro setup` writes them here. |
| `METRO_CONFIG_DIR` | `~/.config/metro` | Where the global `.env` lives. |
| `METRO_STATE_DIR` | `~/.cache/metro` | Lockfile, scope cache, codex socket, telegram offset, claude session set. |
| `METRO_LOG_LEVEL` | `info` | `trace` / `debug` / `info` / `warn` / `error` / `fatal`. |

Token precedence: process env → `./.env` → `$METRO_CONFIG_DIR/.env`. Logs to stderr.

## Develop locally

```bash
git clone https://github.com/bonustrack/metro && cd metro
bun install && bun run build
bun link                                 # makes `metro` resolve to this checkout
METRO_LOG_LEVEL=debug metro
```

## Reference

- `metro --help` — command surface
- `metro doctor` — health check (tokens + gateway/poller reachability + orchestrator status)
- State files (`$METRO_STATE_DIR`, defaults to `~/.cache/metro/`):
  - `scopes.json` — Discord-thread / Telegram-topic ↔ agent-session map
  - `.tail-lock` — orchestrator pid
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
- **Per-agent histories are separate.** Switching with `with codex` mid-scope spins up a fresh Codex session — it has no idea what you discussed with Claude in the same scope. Each agent only sees what was sent to it.
- **One agent missing is OK.** If only `claude` or only `codex` is installed/authenticated, metro still starts; messages asking for the missing one surface an error in chat.
- **Telegram non-forum groups are skipped.** Without a per-topic thread boundary the routing model breaks down. DMs and forum topics (incl. auto-created ones from General) work normally.
- **Telegram bot privacy.** Default Telegram bot privacy is *enabled*, which can block group messages even with @-mentions. Disable in [@BotFather](https://t.me/BotFather) → Bot Settings → Group Privacy → Turn off, then kick + re-invite the bot.
