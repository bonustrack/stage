/** Shared types + pure helpers for the MessengerComposer (extracted for lint
 *  line-budget; behavior identical). */

/** Canonical EXT_MIME lives in lib/xmtp.swarm (the lower-level attachment lib),
 *  surfaced through the messaging facade barrel; re-exported here so existing
 *  composer-side importers keep their path. */
import { EXT_MIME } from '../modules/messaging';

export { EXT_MIME };

/** Composer-local representation of a staged attachment. `url` is a `file://` URI in xmtp
 *  mode (the only mode the mobile composer supports now). `id` is a client-side dedupe key. */
export interface Attachment {
  id: string; url: string; kind: string; mime: string; size: number; name?: string;
}

/** Shared color palette threaded into the composer's builder sheets. */
export interface Palette { fg: string; sub: string; inputBg: string; chipBg: string }

/** Resolve a usable MIME for a staged file. Prefers the picker/recorder-supplied
 *  `mime`, but pickers frequently return `''`/`undefined` (HEIC screenshots,
 *  some Android gallery `content://` rows, the voice recorder on certain OS
 *  builds). An empty MIME breaks the `kind` bucket and the native
 *  `encryptAttachment`/IPFS upload at send time, so fall back to the file
 *  extension, then to a generic binary type. */
export function mimeOf(mime: string | undefined | null, nameOrUri: string): string {
  if (mime && mime.includes('/')) return mime;
  const ext = nameOrUri.split('?')[0]?.split('#')[0]?.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MIME[ext] ?? 'application/octet-stream';
}

/** Inline (StaticAttachment) attachments are encrypted into the MLS message
 *  envelope, which libxmtp caps at ~1 MB. Guard below that with codec overhead
 *  headroom so the send fails fast with a clear, user-facing message instead of
 *  a cryptic native error (restores the pre-#118 inline size guard). The
 *  multi-remote / blob-store path (xmtpSendMultiRemoteAttachment) is the future
 *  home for larger files — currently disabled on the send side because the
 *  pineapple upload endpoint rejects ciphertext. */
export const INLINE_ATTACHMENT_MAX_BYTES = 900 * 1024;
