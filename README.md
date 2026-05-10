# Metro

Chat with your Claude Code or Codex agent over Telegram and Discord. Inbound messages stream into the session live; the agent reacts, types while it works, and replies — pure CLI, ~900 lines of TypeScript, no MCP, no hosted infra.

## Quickstart

```bash
npm install -g @stage-labs/metro@beta    # or: bun add -g @stage-labs/metro@beta

metro setup telegram <token>             # https://t.me/BotFather
# and/or:
metro setup discord <token>              # https://discord.com/developers/applications

metro setup skill                        # auto-onboards Claude Code + Codex agents
metro doctor                             # verify everything works
metro                                    # start the inbound stream (run in background)
```

> The `@beta` tag is required while Metro is in prerelease. Tokens land in `~/.config/metro/.env` (`chmod 0600`). The skill writes to `~/.claude/skills/metro/` and `~/.agents/skills/metro/` so whichever agent runtime you use picks it up automatically.

> **Discord only:** in the Developer Portal → Bot tab, toggle **Message Content Intent** under Privileged Gateway Intents — without it, message bodies arrive empty. Then generate an OAuth invite with the `bot` scope (or DM the bot directly).

DM your bot. The agent reacts on its next decision boundary (see Caveats for latency notes).

## How it works

- **`metro`** — long-running inbound stream. Polls Telegram and connects to Discord's gateway, then prints one JSON line per inbound message on stdout: `{"platform": "telegram"|"discord", "to": "<platform>:<chat>/<message_id>", "text": "…"}`. The agent watches stdout (Bash+Monitor in Claude Code, `unified_exec` in Codex) and acts on each line at its next decision boundary.
- **`metro <reply|react|edit|download|fetch>`** — one-shot subcommands the agent invokes via Bash to act on those inbounds. They all take a single `--to=<platform>:<chat>/<message_id>` address that the agent copies verbatim from the inbound line.
- **`metro setup skill`** — drops a SKILL.md into the agent's skill directory so the agent knows the flow without needing a pasted prompt.

While the agent is working on a reply, both platforms show a typing indicator; when it replies, the indicator stops and the auto-ack 👀 reaction is cleared on the exact message replied to.

## Commands

| Command | Purpose |
|---|---|
| `metro` | Long-running inbound stream. Run in the background. |
| `metro setup` | Status: tokens, skills, what's next. |
| `metro setup telegram\|discord <token>` | Save a bot token to `$METRO_CONFIG_DIR/.env`. Validates the token via `getMe` before writing; `--no-validate` skips. |
| `metro setup clear [telegram\|discord\|all]` | Remove tokens. |
| `metro setup skill [--project] [--clear]` | Install (or remove) the agent skill in both Claude Code (`~/.claude/skills/metro/`) and Codex (`~/.agents/skills/metro/`). `--project` writes to the cwd instead of `$HOME`. |
| `metro doctor` | Health check: tokens, gateway reachability, tail process, skill install state. |
| `metro reply --to=<addr> --text=<t>` | Quote-reply. Clears 👀. |
| `metro react --to=<addr> --emoji=<e>` | Set or clear (`''`) a reaction. |
| `metro edit --to=<addr> --text=<t>` | Edit a message the bot previously sent. |
| `metro send --to=<addr> --text=<t>` | Send a proactive message (no reply context). `<addr>` is channel-only: `<platform>:<chat_id>`. |
| `metro download --to=<addr> [--out=<dir>]` | Pull image attachments to disk; prints absolute paths so the agent can `Read` them. |
| `metro fetch --to=<addr> [--limit=N]` | Recent-message lookback. Discord only — pass channel-only `discord:<channel_id>`. |
| `metro update` | Check npm and upgrade in place (npm/bun/pnpm auto-detected). |
| `metro --version`, `metro --help` | Version, full reference. |

Append `--json` to any non-tail command for a single-line/array JSON result on stdout, with `{"ok":false,"error":"…","code":N}` on failure. Useful when the agent needs to capture `sent_message_id`, downloaded paths, or a fetch array for downstream calls.

`reply` and `edit` accept `--text` either as a flag or via stdin (heredoc-friendly). Telegram-only options: `--parse-mode=HTML|MarkdownV2`, `--no-link-preview`, `--buttons-json='[[{"text":"x","url":"https://…"}]]'`. Voice/audio attachments surface as `[voice]` / `[audio]` placeholders — the agent sees them but can't download.

Address format: `telegram:<chat_id>/<message_id>` or `discord:<channel_id>/<message_id>` (or `discord:<channel_id>` for `fetch`). All come straight off the inbound line.

## Exit codes

- `0` success
- `1` usage error (bad flags, unknown subcommand)
- `2` configuration error (no tokens — run `metro setup`)
- `3` upstream error (rate limit, auth, network — agents should retry once before surfacing)

## Config

| Variable | Default | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | — | Telegram bot token. |
| `DISCORD_BOT_TOKEN` | — | Discord bot token. |
| `METRO_CONFIG_DIR` | `~/.config/metro` (or `$XDG_CONFIG_HOME/metro`) | Where `metro setup` writes `.env`. |
| `METRO_STATE_DIR` | `~/.cache/metro` | Lockfile, typing-stop signals, attachment cache, default `metro download --out`. |
| `METRO_LOG_LEVEL` | `info` | `trace` / `debug` / `info` / `warn` / `error` / `fatal`. |

Tokens are read in precedence order: process environment → `./.env` (cwd, for repo-local dev) → `$METRO_CONFIG_DIR/.env` (written by `metro setup`). Logs go to stderr.

## Troubleshooting

```bash
metro setup                                # show what's configured
metro doctor                               # full health check
metro --help                               # full command reference
which metro                                # → e.g. ~/.bun/bin/metro

ps aux | grep metro | grep -v grep         # verify `metro` is running
rm -rf ~/.cache/metro/                     # clean stuck state — or whatever METRO_STATE_DIR points at
```

## Uninstall

```bash
metro setup clear                         # remove tokens
metro setup skill --clear                 # remove the user-scope skill
metro setup skill --project --clear       # repeat in any repo where you ran `--project`
rm -rf ~/.cache/metro/                    # remove state (lockfile, attachment cache)
npm uninstall -g @stage-labs/metro        # or: bun remove -g, pnpm remove -g
```

(No dedicated `metro uninstall` — Claude Code, npm, and most node CLIs leave package removal to the package manager. The four data paths above are the only state metro creates; clearing them is opt-in and reversible.)

## Caveats

- **Discord Message Content Intent** is privileged — toggle it in the Developer Portal. See above.
- **Telegram single-poller.** Telegram allows one `getUpdates` consumer per bot token. If two `metro` instances start, the second-comer detects the lockfile (`$METRO_STATE_DIR/.tail-lock`) and exits cleanly. Re-run after the first exits to take over.
- **No allowlist.** Anyone who can DM your bot or @-mention it can talk to your session. Run against bots you own.
- **Mid-task latency.** New messages surface at the next agent decision boundary — sub-second on Claude Code (lots of small tool calls), longer on Codex turns. Neither runtime can interrupt an in-progress LLM generation.
- **UI visibility.** Claude Code's `Monitor` collapses stdout into a card; Codex dims tool args. The bundled skill instructs the agent to echo each inbound on its own visible line — install it with `metro setup skill`.
