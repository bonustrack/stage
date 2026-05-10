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

Run several agent sessions concurrently against a single bot by giving each session its own scope: a **Discord thread** (in a parent channel the bot can post in) or a **Telegram forum topic** (in a supergroup with Topics enabled). Each metro instance is told which scope it owns; inbounds outside the scope are dropped silently, and outbound replies auto-thread back into the same scope.

### Discord

```bash
# In Discord, create a thread under a channel the bot is in. Right-click the
# thread → Copy Link → grab the trailing snowflake (the thread's channel id).

METRO_DISCORD_THREAD=<thread_channel_id> metro
```

### Telegram

```bash
# In a supergroup with Topics enabled, create a topic. The topic id is
# `message_thread_id` from any message in it (visible via the Bot API; or
# send any message in the topic and read it back via getUpdates).

METRO_TELEGRAM_TOPIC=<chat_id>:<topic_id> metro
```

### Mixing platforms

A single metro can scope both:
```bash
METRO_DISCORD_THREAD=<thread_id> METRO_TELEGRAM_TOPIC=<chat_id>:<topic_id> metro
```

### Caveats

- **Telegram polling exclusivity.** Only one metro can call `getUpdates` per bot token, so on Telegram only one scoped metro runs per bot today. Multi-session against one bot needs the upcoming hub multiplexer (planned). Discord is unaffected — multiple scoped metros each handle their own thread.
- **Topic-aware outbound.** When `METRO_TELEGRAM_TOPIC` is set and the agent replies/sends to a chat matching the configured chat_id, metro automatically threads the message into that topic. The `<chat>:<topic>` mapping is global per metro instance.
- **Unscoped inbounds.** Without these env vars, metro emits everything (today's behavior). The scope filters are strictly additive and opt-in.

## Config

| Variable | Default | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN`, `DISCORD_BOT_TOKEN` | — | Bot tokens. `metro setup` writes them here. |
| `METRO_CONFIG_DIR` | `~/.config/metro` | Where the global `.env` lives. |
| `METRO_STATE_DIR` | `~/.cache/metro` | Lockfile, attachment cache, default download dir. |
| `METRO_LOG_LEVEL` | `info` | `trace` / `debug` / `info` / `warn` / `error` / `fatal`. |
| `METRO_CODEX_RC` | — | Codex app-server URL (e.g. `ws://127.0.0.1:8421`). When set, metro pushes each inbound into the agent's history via JSON-RPC `turn/start` — the Codex equivalent of Claude Code's Monitor. Accepts `ws://host:port` (required for use with the codex TUI) or `unix:///abs/path` (headless only). See [Codex setup](#run-with-codex). |
| `METRO_DISCORD_THREAD` | — | Discord thread id (channel id). When set, metro only emits/responds to inbounds in that thread. See [Multi-session](#multi-session--one-bot-multiple-agent-sessions). |
| `METRO_TELEGRAM_TOPIC` | — | Forum topic scope as `<chat_id>:<topic_id>`. When set, metro only emits/responds to inbounds in that topic and auto-threads outbound messages back into it. See [Multi-session](#multi-session--one-bot-multiple-agent-sessions). |

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
