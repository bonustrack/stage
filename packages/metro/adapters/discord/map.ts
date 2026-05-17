/**
 * Discord adapter — project a raw event into the universal envelope.
 * `raw.payload`:
 *  - `kind:'message'`  → discord.js `Message.toJSON()` (camelCase).
 *  - `kind:'reaction'` → `{ channelId, guildId, messageId, userId, username, bot, emoji: { name, id } }`.
 * Return `null` to drop (bot self, empty body). Hot-reloaded on save.
 */

export function map(raw, _metro) {
  if (raw.station !== 'discord') return null;
  if (raw.kind === 'message') return mapMessage(raw.payload);
  if (raw.kind === 'reaction') return mapReaction(raw.payload);
  return null;
}

function mapMessage(m) {
  if (!m || m.author?.bot) return null;
  const tags = (m.attachments ?? []).map(a =>
    a.contentType?.startsWith('image/') ? '[image]' : `[file: ${a.name}]`);
  const text = [String(m.content ?? '').trim(), ...tags].filter(Boolean).join(' ');
  if (!text) return null;
  return {
    line: `metro://discord/${m.channelId}`,
    lineName: m.channelName ?? undefined,
    from: `metro://discord/user/${m.author.id}`,
    fromName: m.author.username,
    messageId: m.id,
    text,
    isPrivate: m.guildId == null,
  };
}

function mapReaction(r) {
  if (!r || r.bot || !r.emoji?.name) return null;
  return {
    kind: 'react',
    line: `metro://discord/${r.channelId}`,
    from: `metro://discord/user/${r.userId}`,
    fromName: r.username,
    messageId: r.messageId,
    emoji: r.emoji.name,
    isPrivate: r.guildId == null,
  };
}
