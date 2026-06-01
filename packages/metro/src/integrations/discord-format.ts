/** Discord message/reaction projection into metro envelopes + outbound emitters. */

import type { Message, MessageReaction, User } from 'discord.js';
import { accounts, lineOf } from './discord-accounts.js';
import { emit, mintId, SELF_URI } from './discord-wire.js';

/** Stamp account into payload and (if configured) owner-route inbound `to`. */
export function emitInbound(accountId: string, e: Record<string, unknown>): void {
  const owner = accounts.get(accountId)?.cfg.owner;
  const payload = { ...(e.payload as Record<string, unknown> | undefined), account: accountId };
  emit({ ...e, ...(owner ? { to: owner } : {}), account: accountId, payload });
}

function tagFor(att: { contentType?: string | null; name?: string | null; url?: string }): string {
  if (att.contentType?.startsWith('image/')) return '[image]';
  if (att.contentType?.startsWith('audio/')) return `[audio: ${att.name ?? 'audio'}]`;
  if (att.contentType?.startsWith('video/')) return `[video: ${att.name ?? 'video'}]`;
  return `[file: ${att.name ?? 'file'}]`;
}

export function messageEnvelope(accountId: string, m: Message): Record<string, unknown> | null {
  if (m.author.bot) return null;
  const tags = m.attachments.map(a => tagFor({ contentType: a.contentType, name: a.name, url: a.url }));
  const stickerTags = m.stickers.map(s => `[sticker: ${s.name}]`);
  const text = [m.content.trim(), ...tags, ...stickerTags].filter(Boolean).join(' ');
  return {
    kind: 'inbound', id: mintId(), ts: new Date(m.createdTimestamp).toISOString(),
    station: 'discord', line: lineOf(accountId, m.channelId),
    line_name: 'name' in m.channel ? m.channel.name : undefined,
    from: `metro://discord/${accountId}/user/${m.author.id}`, from_name: m.author.username,
    message_id: m.id, text, is_private: m.guildId == null,
    reply_to: m.reference?.messageId ?? undefined, payload: m.toJSON(),
  };
}

export function reactionEnvelope(
  accountId: string, r: MessageReaction, u: User,
): Record<string, unknown> | null {
  if (u.bot) return null;
  return {
    kind: 'react', id: mintId(), ts: new Date().toISOString(),
    station: 'discord', line: lineOf(accountId, r.message.channelId),
    from: `metro://discord/${accountId}/user/${u.id}`, from_name: u.username,
    message_id: r.message.id, emoji: r.emoji.name ?? r.emoji.id ?? '?',
    is_private: r.message.guildId == null,
    payload: {
      channel_id: r.message.channelId, guild_id: r.message.guildId,
      emoji: r.emoji.toJSON(), user_id: u.id,
    },
  };
}

/** Build the common outbound-event scaffold; `extra` adds text/emoji etc. */
function outbound(kind: string, accountId: string, line: string, messageId: string, extra: object): void {
  emit({
    kind, id: mintId(), ts: new Date().toISOString(),
    station: 'discord', line, from: SELF_URI, to: line, message_id: messageId, ...extra,
    account: accountId, payload: { account: accountId },
  });
}

export function emitOutbound(
  accountId: string, line: string, messageId: string, text: string, replyTo?: string,
): void {
  outbound('outbound', accountId, line, messageId, { text, reply_to: replyTo });
}
export function emitOutboundReact(accountId: string, line: string, messageId: string, emoji: string): void {
  outbound('react', accountId, line, messageId, { emoji });
}
export function emitOutboundEdit(accountId: string, line: string, messageId: string, text: string): void {
  outbound('edit', accountId, line, messageId, { text });
}
