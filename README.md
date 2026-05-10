# Metro

Run a long-lived daemon that bridges Discord (and soon Telegram) to your Codex / Claude Code agent. Each chat thread gets its own agent session with streaming responses and live tool-call status.

## Prereqs

- **Node ≥ 22** (or Bun ≥ 1.3).
- **One agent CLI** installed and authenticated:
  - **Codex** (default) — run `codex` once interactively to log in. Metro spawns `codex app-server` and inherits your auth, MCPs, sandboxing.
  - **Claude Code** — run `claude` once to log in. Metro shells out per turn and inherits your auth, plugins, settings.
- **Discord bot** with **Message Content Intent** enabled (Developer Portal → Bot → Privileged Gateway Intents).

## Quickstart

```bash
npm install -g @stage-labs/metro@beta    # or: bun add -g @stage-labs/metro@beta

metro setup discord <token>              # https://discord.com/developers/applications
metro setup telegram <token>             # https://t.me/BotFather

metro doctor                             # verify
metro                                    # run the orchestrator
```

Metro starts both agents (codex + Claude Code) at boot and listens on whichever platforms are configured. Each scoped conversation defaults to **Claude** for the first turn; once you've used an agent there, follow-up messages stick with it. To switch on a per-message basis, suffix with `with claude` or `with codex` (any casing):

```
@Metro draft a release note
   → uses Claude (default for a new scope)

How would Codex have done this? with codex
   → routes this turn to Codex instead, in the same scope
```

**Discord:** @-mention the bot in a channel to spawn a new thread; in-thread messages route automatically.

**Telegram:** DM the bot directly, or @-mention it in a supergroup forum-topic. Each chat/topic is its own scope. Regular (non-topic) group chats are not routed — they have no thread boundary.

In Discord, **@-mention the bot** in a channel. Metro:

1. creates a thread anchored on your message,
2. spins up a fresh Codex session for that thread,
3. streams the agent's reply back into the thread (with tool-call status, e.g. `running: rg foo`).

Subsequent messages in that thread go straight to the same Codex session — no @-mention needed.

## How it works

```
Discord gateway ──┐                       ┌─▶ codex app-server  (long-lived subprocess)
                  ├─▶ metro orchestrator ─┤
Telegram polling ─┘                       └─▶ claude -p ...      (per-turn subprocess)
                            │
                            └──── scope map (scopes.json)
```

- **One metro = one daemon.** Lockfile at `$METRO_STATE_DIR/.tail-lock` keeps things singleton.
- **Both agents run side-by-side.** A scope can have up to one session per agent — independent histories. Routing is per-message: explicit `with claude` / `with codex` suffix, otherwise the scope's last-used agent, otherwise Claude.
- **Codex** runs as a long-lived `codex app-server` over a UDS, JSON-RPC.
- **Claude Code** has no daemon mode — metro shells out to `claude -p --session-id <uuid> ...` for the first turn and `--resume <uuid>` after.
- **Discord** uses the gateway for inbound, REST for send/edit; threads are scopes.
- **Telegram** long-polls `getUpdates`, REST for send/edit; DMs and forum topics are scopes. The poll offset is persisted at `$METRO_STATE_DIR/telegram-offset.json` so missed messages come back through telegram's own queue on restart.
- **Streaming.** Replies edit one message every ~1500 ms while deltas stream in (with a leading-edge first flush for fast feedback). Tool calls show as a status line (`Running: <command>`, `Editing N files`, …). Messages are auto-split past 1900 chars.
- **Queueing.** Follow-ups that arrive while a turn is running are queued and answered together in the next reply.
- **Catchup-on-restart.** Discord uses a per-scope `lastSeenMessageId` watermark + REST replay; Telegram leans on its own update-id queue.

## Config

| Variable | Default | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN`, `DISCORD_BOT_TOKEN` | — | Bot tokens. `metro setup` writes them here. |
| `METRO_CONFIG_DIR` | `~/.config/metro` | Where the global `.env` lives. |
| `METRO_STATE_DIR` | `~/.cache/metro` | Lockfile, scope cache, codex socket. |
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
- `metro doctor` — health check (tokens + gateway reachability + orchestrator status)
- State: `~/.cache/metro/scopes.json` (thread map), `~/.cache/metro/.tail-lock` (pid), `~/.cache/metro/codex-app-server.sock` (UDS)

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
- **Telegram non-topic groups are skipped.** Without a per-topic thread boundary the routing model breaks down. DMs and forum topics work normally.
