# discord-station

Bridges Discord to the metro Client.

## Setup

Set `DISCORD_BOT_TOKEN` (via `metro setup discord <token>` or in env). The bot
needs these gateway intents:

- `Guilds`
- `GuildMessages` + `MessageContent`
- `GuildMessageReactions`
- `DirectMessages` + `DirectMessageReactions`

## Lines

`metro://discord/<channelId>` — same scheme for DM channels and guild channels;
guild channels show `payload.guildId`.

## Actions

| action     | args                                                                          | returns                    |
|------------|-------------------------------------------------------------------------------|----------------------------|
| `reply`    | `{line, messageId, text, images?, documents?, voice?, buttons?}`              | `{messageId}`              |
| `send`     | `{line, text, replyTo?, images?, documents?, voice?, buttons?}`               | `{messageId}`              |
| `react`    | `{line, messageId, emoji}` (empty string clears)                              | `{ok: true}`               |
| `edit`     | `{line, messageId, text, buttons?}`                                           | `{ok: true}`               |
| `download` | `{line, messageId, outDir}` — writes image attachments under `outDir`         | `{files: [{path, mediaType}]}` |
| `fetch`    | `{line, limit?}` — recent-message lookback (cap 100)                          | `{messages: [...]}`         |
| `getMe`    | `{}` — bot identity                                                            | `{id, username}`            |

Outbound is direct REST; the gateway client is only used for receive.
