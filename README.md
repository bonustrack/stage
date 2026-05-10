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
metro setup telegram <token>             # https://t.me/BotFather  (Telegram routing lands in a follow-up)

metro doctor                             # verify
metro                                    # run the orchestrator with codex (default)
METRO_AGENT=claude metro                 # run with Claude Code instead
```

In Discord, **@-mention the bot** in a channel. Metro:

1. creates a thread anchored on your message,
2. spins up a fresh Codex session for that thread,
3. streams the agent's reply back into the thread (with tool-call status, e.g. `running: rg foo`).

Subsequent messages in that thread go straight to the same Codex session — no @-mention needed.

## How it works

```
Discord gateway ──▶ metro orchestrator ──▶ codex app-server  (METRO_AGENT=codex, default)
                       │                   claude -p ...     (METRO_AGENT=claude, per-turn)
                       └──── thread map ──────────┘
                            (scopes.json)
```

- **One metro = one daemon.** Lockfile at `$METRO_STATE_DIR/.tail-lock` keeps things singleton.
- **One Discord thread ↔ one agent thread.** The map persists in `$METRO_STATE_DIR/scopes.json`, so restarting metro rejoins existing conversations.
- **Codex (default)** runs as a long-lived subprocess. Metro spawns `codex app-server` over a Unix domain socket and talks to it via JSON-RPC.
- **Claude Code** has no daemon mode — metro shells out to `claude -p --session-id <uuid> ...` for the first turn and `--resume <uuid>` for every subsequent one. Streams via `--output-format stream-json --include-partial-messages`.
- **Streaming.** Replies edit a single Discord message every ~1500 ms while deltas stream in. Tool calls show as a status line (`Running: <command>`, `Editing N files`, …) and clear on completion. Messages are auto-split past 1900 chars.
- **Queueing.** Follow-up messages that arrive while a turn is running are queued and answered together in the next reply.

## Config

| Variable | Default | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN`, `DISCORD_BOT_TOKEN` | — | Bot tokens. `metro setup` writes them here. |
| `METRO_AGENT` | `codex` | Which agent backs the bot. `codex` or `claude`. |
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

- **Discord-only for now.** Telegram orchestration lands in a follow-up PR; setup is wired so you can save the token today.
- **No allowlist.** Anyone who can @-mention your bot can spawn an agent session. Run against bots you own.
- **Switching agents mid-stream.** `scopes.json` stores agent thread ids; if you change `METRO_AGENT`, existing thread mappings won't resolve in the new agent. Wipe `~/.cache/metro/scopes.json` to start fresh.
