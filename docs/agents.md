# Metro: a guide for coding agents

You are running inside a **metro** session. Metro bridges your replies to a human on Discord, Telegram, or GitHub. This file is the contract — read it before tools, before planning.

## What you know about each turn

Every user message you receive starts with a small bracketed header, e.g.:

```
[metro: this turn is on metro://discord/123456789. Post elsewhere with `metro send <line> <text>`; list lines with `metro lines`; see stations with `metro stations`.]

<the actual user text>
```

The bracketed line is **your line URI**. Your normal reply goes back to that line automatically. The header is also where you discover the CLI surface.

## The Line URI scheme

A `Line` identifies a single conversation. Form: `metro://<station>/<path>`.

| Station    | Pattern                                          | Example                                            |
|------------|--------------------------------------------------|----------------------------------------------------|
| `discord`  | `metro://discord/<channel-id>`                   | `metro://discord/1234567890`                       |
| `telegram` | `metro://telegram/<chat-id>[/<topic-id>]`        | `metro://telegram/-1001234567890/42`               |
| `github`   | `metro://github/<owner>/<repo>/{issues\|pull}/<n>` | `metro://github/bonustrack/metro/issues/123`     |

The path mirrors GitHub's own URL shape; you can paste a github.com URL and the slug is already correct.

## CLI tools available to you

You have shell access (Bash). Use these commands as you would any other tool:

### `metro lines` — discover conversations

```
$ metro lines
2m ago       claude   metro://discord/1234567890
5m ago       codex    metro://telegram/-100123/42
1h ago       claude   metro://github/foo/bar/issues/3
```

Columns: how recently seen / which agent answered last / the Line. Use this when a user says "the Telegram channel" or "that PR thread" — match by recency or station prefix.

`--json` returns a structured array.

### `metro stations` — discover backends

```
$ metro stations
  ·  claude     agent  in: text+image · out: text · features: stream, tools, cancel, attachments
  ·  codex      agent  in: text+image · out: text · features: stream, tools, cancel, attachments
  ✓  discord    chat   in: text+image · out: text · features: stream, edit, attachments
  ✓  telegram   chat   in: text+image · out: text · features: stream, edit, attachments
  ✗  github     chat   in: text · out: text · features: edit
```

`✓` = configured & ready; `✗` = configured but missing env; `·` = not env-gated.

### `metro send <line> <text>` — relay to another conversation

```bash
metro send metro://telegram/-100123/42 "deploy succeeded"
metro send metro://github/foo/bar/issues/9 "fixed in main, closing"
```

One-shot REST call. Daemon doesn't need to be running. Uses the same env tokens (`TELEGRAM_BOT_TOKEN`, `DISCORD_BOT_TOKEN`, `GITHUB_TOKEN`).

**Quote correctly.** Multi-line or long text needs shell quoting — prefer a single-quoted argument, or use a HEREDOC into stdin if the platform supports it.

## When to use each tool

- **User asks you to relay/post to another conversation** → `metro lines` to find the right URI, then `metro send`.
- **User asks "where else am I talking to you?" or "what conversations are open?"** → `metro lines`.
- **User asks about stations / capabilities / config status** → `metro stations`.
- **You finished a long task and the user is elsewhere** → consider `metro send` to that other line.
- **A teammate is on a different platform** → if you know their line, `metro send` lets you ping them without context-switching the user.

## Conventions

- **Don't repeat the line URI back at the user** unless they ask — it's noise.
- **One natural-language reply per turn**; metro handles streaming the text + tool calls back to the original conversation.
- **GitHub replies are public comments** — match the formality of the issue/PR.
- **Telegram supports markdown**; metro converts on the way out, so write normal markdown.
- **Discord supports markdown + 2000-char message limit**; metro auto-splits long replies.

## Don'ts

- Don't try to spawn another metro daemon. One per machine; the lockfile blocks duplicates.
- Don't `metro send` to your own line — that's just adding latency to your normal reply.
- Don't post to lines that don't appear in `metro lines` unless the user explicitly hands you the URI — it's likely a typo or stale reference.

## Further reading

- URI scheme grammar: [`docs/uri-scheme.md`](uri-scheme.md)
- Source: https://github.com/bonustrack/metro
