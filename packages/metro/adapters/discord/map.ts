/**
 * Discord adapter — projects a raw event into the universal envelope.
 *
 * `raw.payload` shape:
 *  - `kind: 'message'`  — discord.js `Message.toJSON()` (camelCase): `channelId`, `guildId`,
 *    `content`, `author: { id, username, bot }`, `attachments[]`, `reference`, `mentions`,
 *    `channelName?` (set by the transport), `referencedMessage?` (auto-fetched on replies).
 *  - `kind: 'reaction'` — `{ channelId, guildId, messageId, userId, username, bot, emoji: { name, id } }`.
 *
 * Return `null` to drop the event (bot self-messages, empty payloads, …). The daemon hot-reloads
 * this file on save, so you can edit projection without restarting metro.
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
    a.contentType?.startsWith('image/') ? '[image]'
      : a.contentType?.startsWith('audio/') ? `[audio: ${a.name}]`
        : `[file: ${a.name}]`);
  const text = [String(m.content ?? '').trim(), ...tags].filter(Boolean).join(' ');
  if (!text) return null;
  return {
    kind: 'inbound',
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
  if (!r || r.bot) return null;
  const emoji = r.emoji?.name;
  if (!emoji) return null;
  return {
    kind: 'react',
    line: `metro://discord/${r.channelId}`,
    from: `metro://discord/user/${r.userId}`,
    fromName: r.username,
    messageId: r.messageId,
    emoji,
    isPrivate: r.guildId == null,
  };
}
