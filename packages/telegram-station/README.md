# telegram-station

Bridges Telegram (Bot API, long-poll) to the metro Client.

## Setup

Set `TELEGRAM_BOT_TOKEN` (via `metro setup telegram <token>` or in env). Talk to
`@BotFather` and disable group-privacy mode if you want the bot to see normal
group messages.

## Lines

- `metro://telegram/<chatId>` — DM or group (negative `chatId` = group).
- `metro://telegram/<chatId>/<topicId>` — forum topic.

## Actions

| action     | args                                                                          | returns                    |
|------------|-------------------------------------------------------------------------------|----------------------------|
| `reply`    | `{line, messageId, text, images?, documents?, voice?, buttons?}`              | `{messageId}`              |
| `send`     | `{line, text, images?, documents?, voice?, buttons?}`                         | `{messageId}`              |
| `react`    | `{line, messageId, emoji}` (empty string clears)                              | `{ok: true}`               |
| `edit`     | `{line, messageId, text, buttons?}`                                           | `{ok: true}`               |
| `download` | `{line, messageId, outDir}` — only resolves messages seen since daemon start  | `{files: [{path, mediaType}]}` |
| `fetch`    | `{line, limit?}` — Bot API has no history endpoint, always empty              | `{messages: []}`            |
| `getMe`    | `{}` — bot identity                                                            | `{id, username}`            |

Markdown is converted to Telegram HTML; if the parse fails the call retries
plain. The poll offset is persisted to `~/.cache/metro/telegram-offset.json`.
