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

## Config

| Variable | Default | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN`, `DISCORD_BOT_TOKEN` | — | Bot tokens. `metro setup` writes them here. |
| `METRO_CONFIG_DIR` | `~/.config/metro` | Where the global `.env` lives. |
| `METRO_STATE_DIR` | `~/.cache/metro` | Lockfile, attachment cache, default download dir. |
| `METRO_LOG_LEVEL` | `info` | `trace` / `debug` / `info` / `warn` / `error` / `fatal`. |
| `METRO_CODEX_RC` | — | Codex app-server URL (e.g. `ws://127.0.0.1:8421`). When set, metro pushes each inbound into the agent's history via JSON-RPC `turn/start` — the Codex equivalent of Claude Code's Monitor. Accepts `ws://host:port` (required for use with the codex TUI) or `unix:///abs/path` (headless only). See [Codex setup](#codex-setup). |

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
