# Metro: a guide for coding agents

You are running inside a **metro** session. Metro bridges your replies to a human on Discord, Telegram, or GitHub. This file is the contract — read it before reaching for tools.

## The one rule

Every user turn arrives with a bracketed header naming **your line** — the URI of the conversation you're answering.

```
[metro: this turn is on metro://telegram/-100…/247. …]

<the user's actual text>
```

**To reply to that line, just write your answer as normal text.** Metro streams it back automatically — no tool call needed, no `metro send`, no meta-narration. Treat the header purely as orientation.

If you wrap your reply in a `metro send` call to your own line you'll double-render: the human sees the tool call, the send confirmation, and then the streamed text. Don't do that.

## Posting to a *different* conversation

Use `metro send` **only** to post into a line that isn't this turn's line — e.g., the user asks you to ping a Telegram topic from a Discord thread.

```bash
metro send metro://telegram/-100123/42 "deploy succeeded"
metro send metro://github/foo/bar/issues/9 "fixed in main, closing"
```

Quote correctly. Multi-line bodies need shell quoting; prefer single quotes or a HEREDOC.

## Discovery

### `metro lines` — find existing conversations

```
$ metro lines
2m ago       claude   metro://discord/1234567890
5m ago       codex    metro://telegram/-100123/42
1h ago       claude   metro://github/foo/bar/issues/3
```

Columns: how recently seen / which agent answered last / the line URI. Use this when the user says "the Telegram channel" or "that PR thread" — match by recency or station prefix.

`--json` returns structured output.

### `metro stations` — check what's configured

```
$ metro stations
  ✓  discord    chat   in: text+image · out: text · features: stream, edit, attachments
  ✓  telegram   chat   in: text+image · out: text · features: stream, edit, attachments
  ✗  github     chat   in: text · out: text · features: edit
```

`✓` = ready, `✗` = configured but missing env, `·` = not env-gated.

## The Line URI scheme

A `Line` identifies one conversation. Form: `metro://<station>/<path>`.

| Station    | Pattern                                            | Example                                       |
|------------|----------------------------------------------------|-----------------------------------------------|
| `discord`  | `metro://discord/<channel-id>`                     | `metro://discord/1234567890`                  |
| `telegram` | `metro://telegram/<chat-id>[/<topic-id>]`          | `metro://telegram/-1001234567890/42`          |
| `github`   | `metro://github/<owner>/<repo>/{issues\|pull}/<n>` | `metro://github/bonustrack/metro/issues/123`  |

The GitHub path mirrors GitHub's own URL — paste a github.com URL and the slug is already correct.

## Decision tree

- **User wants a reply to *this* turn** → write text. Done.
- **User wants you to relay to another conversation** → `metro lines` to find the URI, then `metro send`.
- **User asks "where are we talking elsewhere?"** → `metro lines`.
- **User asks what platforms / capabilities exist** → `metro stations`.

## Conventions

- **Don't echo the line URI** back at the user unless they ask. It's metadata.
- **Don't narrate the tool** ("I'll now use metro send to…"). The user sees the tool call already.
- **Markdown** works on Discord and Telegram; metro converts as needed.
- **GitHub replies are public comments** — match the formality of the issue/PR.

## Don'ts

- ❌ `metro send` to your own line (double-renders the reply).
- ❌ Posting "Replied on X" meta-confirmations after a tool call.
- ❌ Spawning another metro daemon — one per machine.
- ❌ Posting to lines that don't appear in `metro lines` unless the user hands you the URI explicitly.

## Further reading

- URI scheme spec: [`uri-scheme.md`](uri-scheme.md)
- Source: https://github.com/bonustrack/metro
