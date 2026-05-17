# Metro event shape

Every event metro emits on stdout is one JSON line matching `HistoryEntry`
(see `src/history.ts`). This doc enumerates the `kind` values, the
station -> kind mapping, and the synthetic `text` placeholders.

## `kind` values

| `kind`     | When                                                                  | Notes                                                                |
|------------|-----------------------------------------------------------------------|----------------------------------------------------------------------|
| `inbound`  | Someone (not the metro bot) sent a message on a chat station          | `payload` = station-native message verbatim                          |
| `outbound` | The local user sent via `metro reply` / `metro send`                  | No `payload` (we already know what we sent)                          |
| `edit`     | Upstream message was edited or deleted                                | Deletes carry `text: ''` and `deleted: true` on the payload          |
| `react`    | Someone added an emoji reaction, or cleared theirs                    | `emoji: ''` = cleared (consistent with outbound `metro react x msg ""`) |

The envelope shape (`HistoryEntry`) is the same for every `kind`. Consumers
that need platform-specific details narrow on `station` and read `payload`.

## Per-station event mapping

### Discord (`station: 'discord'`)

| Gateway event              | Metro `kind` | `text`                                  | Notes                                              |
|----------------------------|--------------|-----------------------------------------|----------------------------------------------------|
| `messageCreate`            | `inbound`    | content or synthesized placeholder      | Bot self-messages dropped                          |
| `messageUpdate`            | `edit`       | re-synthesized from the new message     | `deleted: false`                                   |
| `messageDelete`            | `edit`       | `''`                                    | `deleted: true`, only `payload.id` is meaningful   |
| `messageReactionAdd`       | `react`      | n/a (carries `emoji`)                   |                                                    |
| `messageReactionRemove`    | `react`      | n/a (carries `emoji: ''`)               | Same convention as `metro react <line> <msg> ''`   |

`payload` is always `Message.toJSON()` (and for replies, `referencedMessage`
is `fetchReference().toJSON()` grafted on as a sibling field).

### Telegram (`station: 'telegram'`)

`getUpdates.allowed_updates` is `['message', 'edited_message', 'channel_post',
'edited_channel_post', 'message_reaction']`. The default Bot API subset omits
`message_reaction`, so we list it explicitly. Other update types (chat_member,
chat_join_request, message_reaction_count) need a separate opt-in and are
deferred until a consumer needs them.

| Bot API update            | Metro `kind` | `text`                                  | Notes                                       |
|---------------------------|--------------|-----------------------------------------|---------------------------------------------|
| `message`                 | `inbound`    | text/caption or synthesized placeholder | Bot self-messages dropped                   |
| `channel_post`            | `inbound`    | same                                    | Channels (vs groups/DMs)                    |
| `edited_message`          | `edit`       | re-synthesized                          |                                             |
| `edited_channel_post`     | `edit`       | re-synthesized                          |                                             |
| `message_reaction`        | `react`      | n/a (carries `emoji`)                   | `emoji: ''` when the user cleared theirs    |

`payload` is the raw Bot API `Message` (or `MessageReactionUpdated` for
reactions) verbatim - no slicing or projection.

## Synthetic `text` placeholder format

When the upstream message has no inherent text (sticker-only, voice-only,
poll, dice, etc.) metro synthesizes a one-line tag so consumers can route
on `text` alone for common cases. The full original lives in `payload`.

### Discord tags

| Tag                  | Source field                          |
|----------------------|---------------------------------------|
| `[sticker: <name>]`  | `message.stickers[].name`             |
| `[poll]`             | `message.poll` present                |
| `[forwarded]`        | `message.messageSnapshots.size > 0`   |
| `[image]`            | `attachment.contentType` = `image/*`  |
| `[audio: <name>]`    | `attachment.contentType` = `audio/*`  |
| `[video: <name>]`    | `attachment.contentType` = `video/*`  |
| `[file: <name>]`     | other attachments                     |
| `[embed]`            | embeds-only fallback                  |

Mixed messages concatenate: `lol [sticker: kek]`.

### Telegram tags

| Tag                            | Source field                          |
|--------------------------------|---------------------------------------|
| `[sticker: <set>/<emoji>]`     | `sticker.set_name` + `sticker.emoji`  |
| `[animation]`                  | `animation`                           |
| `[video]` / `[video_note]`     | `video` / `video_note`                |
| `[voice]` / `[audio]`          | `voice` / `audio`                     |
| `[image]`                      | `photo[]` or image `document`         |
| `[file: <name>]`               | other `document`                      |
| `[dice: <emoji>=<value>]`      | `dice`                                |
| `[poll]` / `[contact]`         | `poll` / `contact`                    |
| `[location]` / `[venue]`       | `location` / `venue`                  |
| `[member_joined]`              | `new_chat_members`                    |
| `[member_left]`                | `left_chat_member`                    |
| `[pinned]`                     | `pinned_message`                      |
| `[forwarded]`                  | any `forward_origin` / `forward_from*`|

## Consumer guidance

`text` is a best-effort summary for at-a-glance triage. When the placeholder
isn't precise enough, narrow on `payload`:

```jq
# All Telegram dice rolls
select(.station == "telegram" and (.payload.dice // empty))

# All Discord deletes
select(.station == "discord" and .kind == "edit" and .deleted == true)
```

Metro deliberately does not classify event subtypes upstream of the consumer
- if you need finer types than `kind`, derive them from `payload`.
