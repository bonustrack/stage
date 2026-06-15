# Metro Channel (Claude Code Channel MCP server)

Pushes Metro inbound chat (XMTP/Telegram/Discord) into a **running** Claude Code
session as [channel](https://code.claude.com/docs/en/channels) events, so CC reacts
to messages while you're away - no more fragile Monitor/`tail` transport. Two-way:
a `reply` tool sends responses back, and tool-approval prompts are relayed to chat
so you can approve/deny from your phone.

```
 XMTP/TG/Discord ──▶ metro daemon ──SSE /api/tail──▶ metro-channel.ts ──stdio──▶ Claude Code
       ▲                  ▲                                                          │
       └── reply ─────────┴────────────── POST /api/call/<train>/send ◀─────────────┘
```

## Reactions and attachments

**Inbound reactions** are forwarded as channel pushes. An emoji react surfaces as
`👍 reacted to message <shortId>`; on xmtp, un-reacting surfaces as
`👍 removed from message <shortId>`. Other event types (edits/deletes/system) are dropped.

**Inbound attachments** (image/video/audio) ride a two-event flow: the daemon emits the
`msg` event first, then a follow-up `attachmentSaved` event (one per index) carrying the
saved file path, correlated by the top-level event `id`. The server buffers the `msg`,
waits for the `attachmentSaved`, then forwards. Channel content is **string-only** (no
image content blocks), so an image is forwarded as a readable local file **path** that CC
can open with Read. Images over the 4MB gate, and any non-image attachment, fall back to
the path inline in the text.

**Outbound media**: the `reply` tool takes an optional `image_path` (an image) or
`attachment` (`{path, mime?, name?}`). Images route to the daemon's `sendImage` (the
daemon reads the file itself, no base64 round-trip); non-images route to `sendAttachment`
(read + base64 in the server).

## Requirements

- Claude Code **v2.1.80+** (permission relay needs **v2.1.81+**)
- [Bun](https://bun.sh)
- A running Metro daemon with `METRO_MONITOR_TOKEN` set (in `~/.config/metro/.env`)
- Anthropic auth via claude.ai or Console API key (channels are not on Bedrock/Vertex/Foundry).
  On Team/Enterprise an admin must set `channelsEnabled: true`.

## Install

```bash
cd packages/metro-channel
bun install        # only @modelcontextprotocol/sdk + zod (both in Bun cache; no heavy install)
```

## Configure (env vars)

| Var | Default | Purpose |
| --- | --- | --- |
| `METRO_MONITOR_TOKEN` | (required) | Bearer for the daemon monitor endpoints |
| `METRO_BASE_URL` | `http://127.0.0.1:8420` | Metro webhook/monitor HTTP base |
| `METRO_CHANNEL_ALLOWLIST` | Less's tony-account inbox id | Comma-separated allowed sender URIs or trailing ids. `*` disables gating (unsafe) |
| `METRO_CHANNEL_STATIONS` | `xmtp,telegram,discord` | Stations to surface. **`webhook` is always excluded** (flood/crash risk) |

The allowlist gates on the **sender** (`from`), never the conversation - prompt-injection
defense per the Channels spec. Only allowlisted senders can drive tools or answer
permission prompts.

### Token .env fallback

`METRO_MONITOR_TOKEN` and `METRO_BASE_URL` fall back to reading `~/.config/metro/.env`
when the env var is unset at launch. Claude Code rewrites `~/.claude.json` on session
start/exit and can race the env injection, transiently leaving the token unset in
`process.env`; the `.env` read is the safety net so the server still authenticates.

### Live-reload override file (no restart)

A running process's `process.env` is fixed at spawn, so editing env later does nothing
for the current process. To change the allowlist or stations of an already-running
server **without a relaunch**, write `~/.config/metro/metro-channel.json`:

```json
{ "allowlist": "*", "stations": "xmtp,telegram,discord" }
```

This file **wins** over env vars and the built-in defaults. It is mtime-cached (re-read
only when the file changes) and applies on the fly to the SSE gate - no restart needed.
Delete the file to fall back to env/defaults. Note: the very first change to
allowlist/stations after a code update still needs one relaunch; the override file only
avoids restarts thereafter. The SSE subscribe no longer hard-filters `station=` at
connect time; it uses a dynamic `getStations()` gate so override changes take effect live.

## Run

The server is registered in this directory's `.mcp.json` as server name `metro`.
Start Claude Code from `packages/metro-channel/` with the development-channel flag
(custom channels aren't on the Anthropic allowlist during the research preview):

```bash
cd packages/metro-channel
METRO_MONITOR_TOKEN=$(grep METRO_MONITOR_TOKEN ~/.config/metro/.env | cut -d= -f2) \
  claude --dangerously-load-development-channels server:metro
```

On first run CC asks to trust the new `.mcp.json` server - choose **Use this MCP server**.
A dim banner confirms: `Channels (experimental) messages from server:metro inject directly...`.

Registering the server globally in `~/.claude.json` (`mcpServers.metro`) with an absolute
launch command lets you start the channel from **any directory**, not just
`packages/metro-channel/`. A `metro-cc` convenience launcher wraps the long
`claude --dangerously-load-development-channels server:metro` invocation.

## Live test plan

1. **Daemon up**: `metro doctor` (dispatcher running, xmtp train healthy). Do NOT restart it.
2. **Start CC as a channel** (command above) from `packages/metro-channel/`.
   Run `/mcp` - `metro` should show connected.
3. **Inbound**: from your phone, send an XMTP message on the channel line. It arrives in
   the CC session as `<channel source="metro" line="metro://xmtp/tony/..." from="..."
   station="xmtp" message_id="...">your text</channel>`.
4. **Reply**: tell CC to answer. It calls the `reply` tool with that `line`; the message
   lands back in the XMTP conversation on your phone. The CC terminal shows only `sent`.
5. **Permission relay**: ask CC to do something needing approval (e.g. run a write/Bash).
   The local dialog opens AND a `Claude wants to run ... Reply "yes <id>"/"no <id>"`
   prompt arrives in the chat. Reply `yes <id>` from your phone - the tool proceeds.
   (Answer in the terminal too; first answer wins.)

## Notes / spec uncertainties

- Built to the [Channels reference](https://code.claude.com/docs/en/channels-reference):
  `notifications/claude/channel` (push), `reply` tool, `notifications/claude/channel/permission_request`
  + `notifications/claude/channel/permission` (relay). Meta keys are identifiers only
  (underscores), so the metro line rides as `line` (no scheme issues - it's a value, not a key).
- **A local `.mcp.json` shadows the global `~/.claude.json` server entry.** When CC is
  launched from a directory containing `.mcp.json` (e.g. `packages/metro-channel/`), that
  file's `env` block wins over the global `mcpServers.metro` entry. If the local
  `.mcp.json` omits `METRO_CHANNEL_ALLOWLIST`/`METRO_CHANNEL_STATIONS`, the server falls
  back to the hardcoded single-id default allowlist and **drops every message**. Fix: set
  `METRO_CHANNEL_ALLOWLIST` and `METRO_CHANNEL_STATIONS` in whichever `.mcp.json` actually
  launches the server (this package's `.mcp.json` now sets `"*"` and
  `"xmtp,telegram,discord"`). At runtime you can also drop a
  `~/.config/metro/metro-channel.json` override (see above) which beats both.
- Permission relay routes to the **last inbound line** seen. With a single active
  conversation that is exact; multi-conversation routing would need per-request line capture
  (CC's `permission_request` doesn't carry a conversation id, so last-line is the documented pattern).
