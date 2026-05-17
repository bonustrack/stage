/** Discord helpers: synthesize a `text` placeholder when the gateway message has no `content`. */

import type { Message } from 'discord.js';

/** Project a discord.js `Message` into a one-line `text` placeholder. */
export function synthDiscordText(m: Message): string {
  const tags: string[] = [];
  for (const s of m.stickers.values()) tags.push(`[sticker: ${s.name}]`);
  if (m.poll) tags.push('[poll]');
  if (m.messageSnapshots && m.messageSnapshots.size > 0) tags.push('[forwarded]');
  for (const a of m.attachments.values()) {
    if (a.contentType?.startsWith('image/')) tags.push('[image]');
    else if (a.contentType?.startsWith('audio/')) tags.push(`[audio: ${a.name}]`);
    else if (a.contentType?.startsWith('video/')) tags.push(`[video: ${a.name}]`);
    else tags.push(`[file: ${a.name}]`);
  }
  if (m.embeds.length > 0 && !tags.length) tags.push('[embed]');
  const body = m.content.trim();
  return [body, ...tags].filter(Boolean).join(' ');
}
