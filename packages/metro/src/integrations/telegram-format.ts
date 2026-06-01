/** Telegram message types + projection into metro inbound envelopes. */

import { accounts, lineOf } from './telegram-accounts.js';
import { mintId } from './telegram-wire.js';

export type TgMsg = {
  message_id: number; date: number;
  chat: { id: number; type: string; title?: string; first_name?: string };
  from?: { id: number; username?: string; first_name?: string; is_bot?: boolean };
  text?: string; caption?: string;
  message_thread_id?: number; is_topic_message?: boolean;
  photo?: Array<{ file_id: string; file_size?: number }>;
  document?: { file_name?: string; file_id?: string };
  voice?: { file_id?: string; duration?: number };
  audio?: { file_id?: string; file_name?: string };
  video?: { file_id?: string; file_name?: string };
  animation?: { file_id?: string; file_name?: string };
  sticker?: { file_id?: string; emoji?: string; set_name?: string };
  location?: { latitude: number; longitude: number };
  dice?: { emoji: string; value: number };
};

export type TgReaction = {
  chat: { id: number; type: string };
  message_id: number;
  user?: { id: number; username?: string; first_name?: string; is_bot?: boolean };
  date: number;
  old_reaction: Array<{ type: string; emoji?: string }>;
  new_reaction: Array<{ type: string; emoji?: string }>;
};

function lineForMsg(accountId: string, m: TgMsg): { line: string; topicId?: number } {
  const topicId = m.is_topic_message ? m.message_thread_id : undefined;
  return { line: lineOf(accountId, m.chat.id, topicId), topicId };
}

function projectText(m: TgMsg): string {
  const tags: string[] = [];
  if (m.photo?.length) tags.push('[image]');
  if (m.voice) tags.push('[voice]');
  if (m.audio) tags.push(`[audio: ${m.audio.file_name ?? 'audio'}]`);
  if (m.video) tags.push(`[video: ${m.video.file_name ?? 'video'}]`);
  if (m.animation) tags.push(`[gif: ${m.animation.file_name ?? 'gif'}]`);
  if (m.sticker) {
    const set = m.sticker.set_name ? ` · ${m.sticker.set_name}` : '';
    tags.push(`[sticker${m.sticker.emoji ? ` ${m.sticker.emoji}` : ''}${set}]`);
  }
  if (m.document && !m.animation) tags.push(`[file: ${m.document.file_name ?? 'doc'}]`);
  if (m.location) tags.push(`[location: ${m.location.latitude}, ${m.location.longitude}]`);
  if (m.dice) tags.push(`[dice ${m.dice.emoji} = ${m.dice.value}]`);
  return [m.text ?? m.caption, ...tags].filter(Boolean).join(' ');
}

export function envelope(accountId: string, m: TgMsg): Record<string, unknown> {
  const { line } = lineForMsg(accountId, m);
  return {
    kind: 'inbound', id: mintId(), ts: new Date(m.date * 1000).toISOString(),
    station: 'telegram', line,
    line_name: m.chat.title ?? m.chat.first_name ?? undefined,
    from: `metro://telegram/${accountId}/user/${m.from?.id ?? 'unknown'}`,
    from_name: m.from?.username ? `@${m.from.username}` : m.from?.first_name,
    message_id: String(m.message_id), text: projectText(m), payload: m,
    is_private: m.chat.type === 'private',
  };
}

export function reactionEnvelope(accountId: string, r: TgReaction): Record<string, unknown> | null {
  if (r.user?.is_bot) return null;
  const newEmojis = r.new_reaction.filter(x => x.type === 'emoji').map(x => x.emoji ?? '');
  const oldEmojis = r.old_reaction.filter(x => x.type === 'emoji').map(x => x.emoji ?? '');
  const added = newEmojis.filter(e => !oldEmojis.includes(e));
  if (!added.length) return null;
  return {
    kind: 'react', id: mintId(), ts: new Date(r.date * 1000).toISOString(),
    station: 'telegram', line: lineOf(accountId, r.chat.id),
    from: `metro://telegram/${accountId}/user/${r.user?.id ?? 'unknown'}`,
    from_name: r.user?.username ? `@${r.user.username}` : r.user?.first_name,
    message_id: String(r.message_id), emoji: added[0],
    is_private: r.chat.type === 'private', payload: r,
  };
}

/** Tag an inbound event with its account and (if configured) owner-route it. */
export function emitInbound(emit: (e: unknown) => void, accountId: string, e: Record<string, unknown>): void {
  const owner = accounts.get(accountId)?.cfg.owner;
  const payload = { ...(e.payload as Record<string, unknown> | undefined), account: accountId };
  emit({ ...e, ...(owner ? { to: owner } : {}), account: accountId, payload });
}
