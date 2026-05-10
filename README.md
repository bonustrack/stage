# Metro

Chat with your Claude Code or Codex agent over Telegram and Discord.

## Quickstart

In your shell:

```bash
npm install -g @stage-labs/metro@beta    # or: bun add -g @stage-labs/metro@beta

metro setup telegram <token>             # https://t.me/BotFather
metro setup discord  <token>             # https://discord.com/developers/applications

metro setup skill                        # writes SKILL.md so Claude Code + Codex auto-onboard
metro doctor                             # verify
```

> **Discord setup:** toggle **Message Content Intent** in Developer Portal → Bot → Privileged Gateway Intents.

Open Claude Code (`claude`) or Codex (with one extra setup step — see below), and tell it:

> Run `metro` in the background.

DM your bot. The agent picks up the next inbound and replies — the bundled skill handles launching, stdout watching, reactions, and replies.

### Codex setup

Codex doesn't have an equivalent of Claude Code's `Monitor` — its `unified_exec` is poll-only ([issue #4751](https://github.com/openai/codex/issues/4751)). Metro instead pushes each inbound into the agent's history via JSON-RPC over the `codex remote-control` socket:

```bash
codex remote-control     # one-time per machine — starts the managed daemon
metro                    # auto-detects the daemon's UDS at $CODEX_HOME/app-server-control/app-server-control.sock
codex                    # the TUI; talks to the same daemon
```

No env var, no port, no flags. Each metro inbound triggers a `turn/start` on the active codex thread — sub-second reaction, no polling.

For non-default setups (TCP, custom socket path, etc.), set `METRO_CODEX_RC` to one of:
- `unix:///absolute/path/to/socket` — UDS at a non-default location
- `ws://host:port` — TCP WebSocket (e.g. `codex app-server --listen ws://127.0.0.1:8421`)

## Config

| Variable | Default | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN`, `DISCORD_BOT_TOKEN` | — | Bot tokens. `metro setup` writes them here. |
| `METRO_CONFIG_DIR` | `~/.config/metro` | Where the global `.env` lives. |
| `METRO_STATE_DIR` | `~/.cache/metro` | Lockfile, attachment cache, default download dir. |
| `METRO_LOG_LEVEL` | `info` | `trace` / `debug` / `info` / `warn` / `error` / `fatal`. |
| `METRO_CODEX_RC` | auto-detected from `$CODEX_HOME/app-server-control/...` | Override the codex-rc URL. Accepts `unix:///abs/path` (UDS, default) or `ws://host:port` (TCP). When unset and `codex remote-control` is running, metro auto-connects. See [Codex setup](#codex-setup). |

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
