/** Metro message EDIT + UNSEND content types - shared between the RN app, web
 *  client, and daemon. Pure TS: wire shapes, content-type id constants, and
 *  plain-text fallback builders.
 *
 *  There is NO official XMTP edit / unsend content type, so these are CUSTOM
 *  Metro content types under our own `metro.box` authority, mirroring the poll /
 *  signature / tx codec convention. Hand-rolled JSContentCodecs in RN (see
 *  apps/app/lib/xmtpEditCodec.ts).
 *
 *  DESIGN: an edit / unsend is its own message that REFERENCES the original by
 *  its XMTP message id (like a reaction's `reference`). The feed-fold step
 *  (feed-helpers.resolveEdits) supersedes the original's text with the latest
 *  edit and tombstones an unsent message - so edits/unsends sync cross-device
 *  and survive resync with zero mutation of the immutable original message.
 *
 *  WHO CAN EDIT/UNSEND: only the ORIGINAL sender. The fold enforces this by
 *  matching the edit/unsend author against the target message's author, so a
 *  forged edit from another member is ignored.
 *
 *  CROSS-CLIENT: a client without these codecs simply ignores the custom type
 *  (the original text stays as-is for them). The fallback string keeps a vanilla
 *  XMTP client from rendering a blank bubble. */

/** An EDIT - supersedes the referenced message's text. */
export interface EditContent {
  /** XMTP message id of the original message being edited. */
  messageId: string;
  /** The new, full replacement text. */
  text: string;
}

/** An UNSEND (delete) - tombstones the referenced message. */
export interface UnsendContent {
  /** XMTP message id of the message being unsent. */
  messageId: string;
}

/** Full content-type id strings, RN-SDK form. */
export const EDIT_CONTENT_TYPE_ID = 'metro.box/edit:1.0';
export const UNSEND_CONTENT_TYPE_ID = 'metro.box/unsend:1.0';
/** Authority-less short forms used by the envelope/preview switches. */
export const EDIT_CONTENT_TYPE_SHORT = 'edit';
export const UNSEND_CONTENT_TYPE_SHORT = 'unsend';

/** Plain-text rendering used as the EncodedContent.fallback (so vanilla XMTP
 *  clients render something readable) and as the envelope `text`. An edit's
 *  fallback IS the new body so a client without the codec shows the edited
 *  text as a normal (if duplicated) message rather than a blank bubble. */
export function editFallbackText(edit: EditContent): string {
  return edit.text;
}

export function unsendFallbackText(_unsend: UnsendContent): string {
  return 'Message deleted';
}
