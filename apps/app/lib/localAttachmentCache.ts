/** Session-scoped cache of the LOCAL `file://` URIs for attachments the user just
 *  sent, keyed by message id. Bridges the optimistic→confirmed handoff for image
 *  (and other) attachments:
 *
 *   - The optimistic bubble renders the local picker URI instantly (shows at once).
 *   - On confirm, that bubble is dropped and replaced by the LIVE message, whose
 *     attachment is a `multiRemoteAttachment` placeholder — its bytes still have to
 *     be downloaded + decrypted from IPFS (`RemoteAttachmentResolver`). That round
 *     trip left a blank/spinner gap for a few seconds → the image "disappeared"
 *     then "reappeared".
 *
 *  By remembering the local URI under the optimistic id and re-keying it to the
 *  real XMTP message id the moment `conv.send()` resolves, the resolver can paint
 *  the already-on-disk local file immediately (no blank, no spinner) while the
 *  remote download happens in the background — so there's zero flicker.
 *
 *  The cache holds plain `file://` cache-dir URIs (already materialised by the
 *  picker / send path), so it costs nothing to keep for the app session; entries
 *  are dropped once the optimistic id is forgotten or on app restart. */

/** messageId → ordered list of local `file://` URIs (one per attachment, in the
 *  same order the composer staged them). */
const byMessageId = new Map<string, string[]>();

/** Remember the local URIs for a freshly-staged optimistic send, keyed by its
 *  local id. Empty/falsey uris are skipped — only on-disk locals are useful. */
export function rememberLocalAttachments(messageId: string, uris: ReadonlyArray<string | undefined>): void {
  const locals = uris.map(u => u ?? '');
  if (locals.every(u => u === '')) return;
  byMessageId.set(messageId, [...locals]);
}

/** Local `file://` URI for the attachment at `index` of `messageId`, if one was
 *  cached for a send made this session. Used by the bubble renderer as the
 *  instant, blank-free image source while the remote copy downloads. */
export function getLocalAttachment(messageId: string, index: number): string | undefined {
  const uri = byMessageId.get(messageId)?.[index];
  return uri ? uri : undefined;
}
