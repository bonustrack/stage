/** Persist inbound Telegram media to disk so the agent can read it. Media is
 *  referenced by `file_id`: resolve via Bot API (getFile → file_path), download
 *  from the file endpoint, write to ATT_DIR. Mirrors the XMTP convention. */

import { tg, accounts } from './accounts.js';
import type { TgMsg } from './format.js';

const ATT_DIR = process.env.METRO_XMTP_ATTACH_DIR
  ?? `${process.env.HOME}/.cache/metro/messenger-uploads`;

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
  'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'application/pdf': 'pdf',
};

function extFromPath(filePath: string | undefined, fileName: string | undefined, mime: string | undefined): string {
  const fromName = (fileName ?? filePath)?.split('?')[0]?.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length >= 1 && fromName.length <= 5) return fromName;
  if (mime && MIME_EXT[mime]) return MIME_EXT[mime];
  if (mime?.startsWith('image/')) return mime.slice(6).replace('jpeg', 'jpg');
  return 'bin';
}

export type SavedAttachment = { path: string; mime?: string; name?: string; bytes: number };

/** A single downloadable media reference extracted from a Telegram message. */
export type TgMediaRef = { fileId: string; name?: string; mime?: string };

/** Pick the downloadable media from a message: largest photo size, or doc/video/
 *  audio/voice/animation/sticker. Returns null for non-media messages. */
export function mediaRefOf(m: TgMsg): TgMediaRef | null {
  if (m.photo?.length) {
    const largest = m.photo[m.photo.length - 1];
    return { fileId: largest.file_id, mime: 'image/jpeg' };
  }
  if (m.document?.file_id) return { fileId: m.document.file_id, name: m.document.file_name };
  if (m.video?.file_id) return { fileId: m.video.file_id, name: m.video.file_name, mime: 'video/mp4' };
  if (m.animation?.file_id) return { fileId: m.animation.file_id, name: m.animation.file_name };
  if (m.audio?.file_id) return { fileId: m.audio.file_id, name: m.audio.file_name };
  if (m.voice?.file_id) return { fileId: m.voice.file_id, mime: 'audio/ogg' };
  if (m.sticker?.file_id) return { fileId: m.sticker.file_id, mime: 'image/webp' };
  return null;
}

/** Resolve a Telegram file_id → download bytes → write to disk. */
export async function saveTelegramMedia(
  accountId: string, ref: TgMediaRef, messageId: string, index = 0,
): Promise<SavedAttachment> {
  const file = await tg<{ file_path?: string }>(accountId, 'getFile', { file_id: ref.fileId });
  if (!file.file_path) throw new Error(`telegram getFile returned no file_path for ${ref.fileId}`);
  const acct = accounts.get(accountId);
  if (!acct) throw new Error(`unknown account '${accountId}'`);
  const res = await fetch(`${acct.fileApi}/${file.file_path}`, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`telegram file download ${res.status} for ${file.file_path}`);
  const data = new Uint8Array(await res.arrayBuffer());
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  await mkdir(ATT_DIR, { recursive: true });
  const safeId = messageId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16) || 'unknown';
  const ext = extFromPath(file.file_path, ref.name, ref.mime);
  const path = join(ATT_DIR, `msg_${safeId}_${index}.${ext}`);
  await writeFile(path, data);
  return { path, mime: ref.mime, name: ref.name, bytes: data.length };
}
