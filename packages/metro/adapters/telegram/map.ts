/**
 * Telegram adapter — projects a raw Bot API update into the universal envelope.
 *
 * `raw.payload` shape:
 *  - `kind: 'message'`  — Bot API `Message` (snake_case): `message_id, chat, from, text/caption,
 *    photo[], document, voice, audio, reply_to_message, message_thread_id, is_topic_message`, …
 *  - `kind: 'reaction'` — `MessageReactionUpdated`: `chat, message_id, user, old_reaction, new_reaction`.
 *
 * Return `null` to drop. Daemon hot-reloads on save.
 */

export function map(raw, _metro) {
  if (raw.station !== 'telegram') return null;
  if (raw.kind === 'message') return mapMessage(raw.payload);
  if (raw.kind === 'reaction') return mapReaction(raw.payload);
  return null;
}

function attachmentTags(m) {
  const out = [];
  if (m.photo?.length) out.push('[image]');
  if (m.document?.mime_type?.startsWith('image/')) out.push('[image]');
  else if (m.document) out.push(`[file: ${m.document.file_name ?? m.document.file_id}]`);
  if (m.voice) out.push('[voice]');
  if (m.audio) out.push('[audio]');
  return out;
}

function mapMessage(m) {
  if (!m?.chat?.id || typeof m.message_id !== 'number' || m.from?.is_bot) return null;
  const body = m.text ?? m.caption ?? '';
  const text = [body, ...attachmentTags(m)].filter(Boolean).join(' ');
  if (!text) return null;
  const topicId = m.is_topic_message ? m.message_thread_id : undefined;
  const fromName = m.from?.username ? `@${m.from.username}` : m.from?.first_name;
  const line = topicId !== undefined
    ? `metro://telegram/${m.chat.id}/${topicId}`
    : `metro://telegram/${m.chat.id}`;
  return {
    kind: 'inbound',
    line,
    lineName: topicId === undefined ? (m.chat.title ?? m.chat.first_name ?? undefined) : undefined,
    from: `metro://telegram/user/${m.from?.id ?? 'unknown'}`,
    fromName,
    messageId: String(m.message_id),
    text,
    isPrivate: m.chat.type === 'private',
  };
}

function mapReaction(r) {
  if (!r?.user || r.user.is_bot) return null;
  const had = new Set((r.old_reaction ?? []).filter(x => x.type === 'emoji').map(x => x.emoji));
  const added = (r.new_reaction ?? []).filter(x => x.type === 'emoji').map(x => x.emoji).filter(e => !had.has(e));
  if (!added.length) return null;
  const emoji = added[0];
  const fromName = r.user.username ? `@${r.user.username}` : r.user.first_name;
  return {
    kind: 'react',
    line: `metro://telegram/${r.chat.id}`,
    lineName: r.chat.title ?? r.chat.first_name ?? undefined,
    from: `metro://telegram/user/${r.user.id}`,
    fromName,
    messageId: String(r.message_id),
    emoji,
    isPrivate: r.chat.type === 'private',
  };
}
