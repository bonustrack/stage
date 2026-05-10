# Metro

Chat with your Claude Code or Codex agent over Telegram and Discord.

## Quickstart

In your shell:

```bash
npm install -g @stage-labs/metro@beta    # or: bun add -g @stage-labs/metro@beta

metro setup telegram <token>    # https://t.me/BotFather
metro setup discord <token>     # https://discord.com/developers/applications

metro setup skill                        # writes SKILL.md so Claude Code + Codex auto-onboard
metro doctor                             # verify
```

> **Discord setup:** toggle **Message Content Intent** in Developer Portal → Bot → Privileged Gateway Intents.

### Run with Claude Code

```bash
claude
> Run metro in the background.
```

Then DM your bot. The bundled skill auto-triggers — the agent launches metro via Bash + Monitor, watches stdout, and replies.

### Run with Codex

Codex's `unified_exec` is poll-only ([#4751](https://github.com/openai/codex/issues/4751)) — there's no Monitor equivalent. Metro instead pushes each inbound into the agent's history via JSON-RPC. Two terminals plus a prompt — the TUI's `--remote` flag only accepts `ws://`, so daemon and TUI share one URL:

```bash
# Terminal 1 — daemon (must be running first)
codex app-server --listen ws://127.0.0.1:8421

# Terminal 2 — TUI attached to the daemon
codex --remote ws://127.0.0.1:8421
> Run metro in the background.
```

The agent launches `metro` (with `METRO_CODEX_RC=ws://127.0.0.1:8421` set) via its shell tool. Metro connects to the daemon and pushes each inbound as a `turn/start` on the active thread — the agent in terminal 2 reacts on its next turn. `codex remote-control` is stdio-only (no listener), so don't use it for this flow.

Bare `codex` (no `--remote`) can't work with metro — the agent has no daemon to push to. The TUI must be attached to a running app-server.

`METRO_CODEX_RC` accepts `ws://host:port` (required for use with the codex TUI) or `unix:///abs/path` (headless only — the daemon supports UDS but the TUI doesn't).

## Multi-session — one bot, multiple agent sessions

Run several agent sessions concurrently against a single bot by giving each session its own scope: a **Discord thread** or a **Telegram forum topic**. Metro auto-creates the thread/topic on first launch and reuses it on subsequent launches with the same session name (cached in `$METRO_STATE_DIR/scopes.json`).

### One-time bot setup

- **Discord:** invite the bot to a server. The bot needs `Send Messages` and `Create Public Threads` on whichever channels you'll @-mention it from.
- **Telegram:** add the bot to a supergroup, enable Topics in group settings, promote the bot to admin with `Manage Topics`.

### Per-session usage

Pick a session name. The Discord and Telegram setups have different triggers (Discord is interactive via @-mention; Telegram needs a parent supergroup):

```bash
# Example: a "frontend" session (Telegram-only or both)
METRO_SESSION_NAME=frontend \
METRO_TELEGRAM_PARENT_CHAT=<supergroup_id> \
metro
```

**Discord:** with `METRO_SESSION_NAME` set, metro waits for you to @-mention the bot in any channel of your server. First mention becomes the trigger — metro creates a thread anchored to that message, posts *"Session 'frontend' ready — message me here"*, and locks the scope. Type in the thread; agent responds.

**Telegram:** on first launch metro calls `createForumTopic` in the parent supergroup, named after the session. Subsequent launches with the same name reuse the same topic.

Re-running with the same session name reuses the cached scope on both platforms. Two different session names → two separate scopes.

You can opt into just one platform — set only `METRO_TELEGRAM_PARENT_CHAT` for Telegram-only, or set neither for Discord-only (the @-mention path is automatic when `METRO_SESSION_NAME` is set).

### Manual scoping (skip auto-create)

If you already have a thread/topic, set the explicit ids and metro attaches without creating:

```bash
METRO_DISCORD_THREAD=<thread_channel_id> metro
METRO_TELEGRAM_TOPIC=<chat_id>:<topic_id> metro
```

### Caveats

- **Telegram polling exclusivity.** Only one metro can call `getUpdates` per bot token, so on Telegram only one scoped metro runs per bot today. Multi-session against one bot needs the upcoming hub multiplexer (planned). Discord is unaffected — multiple scoped metros each handle their own thread.
- **Cache cleanup.** If you delete a thread/topic in the platform UI, the cached id at `$METRO_STATE_DIR/scopes.json` will 404 on next launch. Remove the entry by hand (or `rm` the file to start fresh).
- **Unscoped inbounds.** Without these env vars, metro emits everything (today's behavior). Scoping is strictly opt-in.

## Config

| Variable | Default | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN`, `DISCORD_BOT_TOKEN` | — | Bot tokens. `metro setup` writes them here. |
| `METRO_CONFIG_DIR` | `~/.config/metro` | Where the global `.env` lives. |
| `METRO_STATE_DIR` | `~/.cache/metro` | Lockfile, attachment cache, default download dir. |
| `METRO_LOG_LEVEL` | `info` | `trace` / `debug` / `info` / `warn` / `error` / `fatal`. |
| `METRO_CODEX_RC` | — | Codex app-server URL (e.g. `ws://127.0.0.1:8421`). When set, metro pushes each inbound into the agent's history via JSON-RPC `turn/start` — the Codex equivalent of Claude Code's Monitor. Accepts `ws://host:port` (required for use with the codex TUI) or `unix:///abs/path` (headless only). See [Codex setup](#run-with-codex). |
| `METRO_SESSION_NAME` | — | Names a scope. On Discord, metro waits for an @-mention to bootstrap the thread; on Telegram (with `METRO_TELEGRAM_PARENT_CHAT`) it auto-creates the topic on first launch. Cached at `$METRO_STATE_DIR/scopes.json`. See [Multi-session](#multi-session--one-bot-multiple-agent-sessions). |
| `METRO_TELEGRAM_PARENT_CHAT` | — | Topics-enabled supergroup id where the bot creates this session's topic. Required for auto-create on Telegram. |
| `METRO_DISCORD_THREAD` | — | Pre-existing thread channel id. Skips auto-create — metro just attaches. |
| `METRO_TELEGRAM_TOPIC` | — | Pre-existing topic as `<chat_id>:<topic_id>`. Skips auto-create. |

Token precedence: process env → `./.env` → `$METRO_CONFIG_DIR/.env`. Logs to stderr.

## Reference

- `metro --help` — command surface
- `metro doctor` — health check
- [SKILL.md](skills/metro/SKILL.md) — agent-facing flow

## Uninstall

```bash
metro setup clear; metro setup skill --clear
rm -rf ~/.cache/metro/
npm uninstall -g @stage-labs/metro
```

## Caveats

- **No allowlist.** Anyone who can DM your bot or @-mention it can talk to your session. Run against bots you own.
- **Latency.** Inbounds surface at the next agent decision boundary — sub-second on Claude Code, longer on Codex turns.
