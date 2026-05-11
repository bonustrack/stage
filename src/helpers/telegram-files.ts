/** Telegram file download helpers — getFile + fetch into a Buffer for image attachments. */

import type { Attachment } from '../agents/types.js';
import { errMsg, log } from '../log.js';

const API_BASE = 'https://api.telegram.org';
const MAX_BYTES = 20 * 1024 * 1024;

type RawFile = { file_id: string; mime_type?: string };
type Photo = { file_id: string };
export type RawAttachments = { photo?: Photo[]; document?: RawFile };

/** Pull image attachments (largest photo + image-mime documents) as decoded Buffers. */
export async function fetchAttachments(
  m: RawAttachments,
  token: string,
  call: <T>(method: string, body: unknown) => Promise<T>,
): Promise<Attachment[]> {
  const refs: { id: string; mime: string }[] = [];
  if (m.photo?.length) refs.push({ id: m.photo[m.photo.length - 1].file_id, mime: 'image/jpeg' });
  if (m.document?.mime_type?.startsWith('image/')) refs.push({ id: m.document.file_id, mime: m.document.mime_type });
  const out: Attachment[] = [];
  for (const { id, mime } of refs) {
    try {
      const file = await call<{ file_path: string }>('getFile', { file_id: id });
      const res = await fetch(`${API_BASE}/file/bot${token}/${file.file_path}`, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > MAX_BYTES) { log.warn({ id, size: buf.byteLength }, 'telegram: attachment too large; skipped'); continue; }
      out.push({ mediaType: mime, data: buf });
    } catch (err) { log.warn({ err: errMsg(err), id }, 'telegram: attachment fetch failed'); }
  }
  return out;
}
