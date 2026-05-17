/**
 * Telegram adapter — project a raw Bot API update into the universal envelope.
 * `raw.payload`:
 *  - `kind:'message'`  → Bot API `Message` (snake_case).
 *  - `kind:'reaction'` → `MessageReactionUpdated`.
 * Return `null` to drop. Hot-reloaded on save.
 */

export function map(raw, _metro) {
  if (raw.station !== 'telegram') return null;
  if (raw.kind === 'message') return mapMessage(raw.payload);
  if (raw.kind === 'reaction') return mapReaction(raw.payload);
  return null;
}

function tag(m) {
  if (m.photo?.length || m.document?.mime_type?.startsWith('image/')) return '[image]';
  if (m.document) return `[file: ${m.document.file_name ?? m.document.file_id}]`;
  if (m.voice) return '[voice]';
  if (m.audio) return '[audio]';
  return '';
}

function fromName(u) {
  return u?.username ? `@${u.username}` : u?.first_name;
}

function mapMessage(m) {
  if (!m?.chat?.id || typeof m.message_id !== 'number' || m.from?.is_bot) return null;
  const text = [m.text ?? m.caption ?? '', tag(m)].filter(Boolean).join(' ');
  if (!text) return null;
  const topic = m.is_topic_message ? m.message_thread_id : undefined;
  return {
    line: topic !== undefined
      ? `metro://telegram/${m.chat.id}/${topic}`
      : `metro://telegram/${m.chat.id}`,
    lineName: topic === undefined ? (m.chat.title ?? m.chat.first_name ?? undefined) : undefined,
    from: `metro://telegram/user/${m.from?.id ?? 'unknown'}`,
    fromName: fromName(m.from),
    messageId: String(m.message_id),
    text,
    isPrivate: m.chat.type === 'private',
  };
}

function mapReaction(r) {
  if (!r?.user || r.user.is_bot) return null;
  const had = new Set((r.old_reaction ?? []).filter(x => x.type === 'emoji').map(x => x.emoji));
  const added = (r.new_reaction ?? []).filter(x => x.type === 'emoji').map(x => x.emoji).find(e => !had.has(e));
  if (!added) return null;
  return {
    kind: 'react',
    line: `metro://telegram/${r.chat.id}`,
    lineName: r.chat.title ?? r.chat.first_name ?? undefined,
    from: `metro://telegram/user/${r.user.id}`,
    fromName: fromName(r.user),
    messageId: String(r.message_id),
    emoji: added,
    isPrivate: r.chat.type === 'private',
  };
}
