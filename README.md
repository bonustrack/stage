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

Codex doesn't have an equivalent of Claude Code's `Monitor` — its `unified_exec` is poll-only and can't push stdout between turns ([issue #4751](https://github.com/openai/codex/issues/4751)). Metro instead pushes each inbound straight into the agent's history via JSON-RPC. Two extra steps:

```bash
# Terminal 1 — start the codex daemon (headless, exposes JSON-RPC over WebSocket):
codex app-server --listen ws://127.0.0.1:8421
# (or: `codex remote-control`, equivalent shorter form)

# Terminal 2 — point metro at the daemon, then run as usual:
export METRO_CODEX_RC=ws://127.0.0.1:8421
metro

# Terminal 3 — Codex TUI client (optional; the user-facing prompt). Connects to the same daemon.
codex
```

Now each metro inbound triggers a `turn/start` on the active codex thread, just as if the user had typed the inbound JSON themselves. Sub-second reaction time, no polling.

## Config

| Variable | Default | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN`, `DISCORD_BOT_TOKEN` | — | Bot tokens. `metro setup` writes them here. |
| `METRO_CONFIG_DIR` | `~/.config/metro` | Where the global `.env` lives. |
| `METRO_STATE_DIR` | `~/.cache/metro` | Lockfile, attachment cache, default download dir. |
| `METRO_LOG_LEVEL` | `info` | `trace` / `debug` / `info` / `warn` / `error` / `fatal`. |
| `METRO_CODEX_RC` | — | Codex app-server WebSocket URL (e.g. `ws://127.0.0.1:8421`). When set, metro pushes each inbound into the agent via `turn/start` JSON-RPC — the Codex equivalent of Claude Code's Monitor. See [Codex setup](#codex-setup). |

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
