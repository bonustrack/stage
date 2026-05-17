/** Telegram helpers: text-placeholder synthesis for media-only / no-text Bot API messages. */

import type { TelegramPayload } from './telegram-types.js';

/** Build a one-line `text` placeholder for a Bot API message; '' when nothing recognizable. */
export function synthTelegramText(m: TelegramPayload): string {
  const direct = m.text ?? m.caption;
  if (direct) return [direct, ...attachmentTags(m)].filter(Boolean).join(' ');
  return attachmentTags(m).join(' ');
}

function attachmentTags(m: TelegramPayload): string[] {
  const out: string[] = [];
  if (m.sticker) {
    const parts = [m.sticker.set_name, m.sticker.emoji].filter(Boolean).join('/');
    out.push(`[sticker: ${parts || m.sticker.file_id}]`);
  }
  if (m.animation) out.push('[animation]');
  if (m.video) out.push('[video]');
  if (m.video_note) out.push('[video_note]');
  if (m.voice) out.push('[voice]');
  if (m.audio) out.push('[audio]');
  if (m.photo?.length && !m.sticker) out.push('[image]');
  if (m.document?.mime_type?.startsWith('image/')) out.push('[image]');
  else if (m.document) out.push(`[file: ${m.document.file_name ?? m.document.file_id}]`);
  if (m.dice) out.push(`[dice: ${m.dice.emoji ?? '🎲'}=${m.dice.value ?? '?'}]`);
  if (m.poll) out.push('[poll]');
  if (m.contact) out.push('[contact]');
  if (m.location) out.push('[location]');
  if (m.venue) out.push('[venue]');
  if (m.new_chat_members?.length) out.push('[member_joined]');
  if (m.left_chat_member) out.push('[member_left]');
  if (m.pinned_message) out.push('[pinned]');
  if (m.forward_origin || m.forward_from || m.forward_from_chat) out.push('[forwarded]');
  return out;
}
