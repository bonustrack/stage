/** @file Pure metro:// line-URI build/parse helpers (framework-agnostic, no @xmtp/react-native/expo) shared across app, web, and daemon: `metro://xmtp/<convId>` for a conversation and `metro://xmtp/user/<0xAddress>` for an address-shared DM. */

/** URI prefix used for inbound XMTP "from" addresses and DM-by-address links. Mirrors the daemon-side train so the rest of the app relies on one convention. */
export const XMTP_USER_PREFIX = 'metro://xmtp/user/';

/** Format a metro-style line URI for an XMTP conversation. */
export function lineOfConv(convId: string): string {
  return `metro://xmtp/${convId}`;
}

/** Shareable link for a 1-1 DM, addressed by the peer's Ethereum address since DM conversation ids are installation-local and mean nothing to the recipient — each side resolves it to their own local DM. */
export function lineOfDmPeer(address: string): string {
  return `${XMTP_USER_PREFIX}${address}`;
}

/** Two brands share one codebase (Metro and Stage), so the detectors accept BOTH custom schemes and BOTH https hosts (path- or hash-routed) to resolve a link minted by either surface to the same card. */
const LINK_PREFIX =
  /** metro:// | stage://  (custom scheme, authority IS the path) */
  '(?:(?:metro|stage):\\/\\/' +
  /** OR  https://{metro,stage}.box/  optionally hash-routed (#/...) */
  '|https?:\\/\\/(?:metro|stage)\\.box\\/(?:#\\/)?)';

/** Extract the peer Ethereum address from a DM-by-address link found anywhere in text, across both brands and link forms (including the web user-profile permalink); null when none. Checked BEFORE metroConvIdOf so the literal "user" segment isn't mistaken for a conversation id. */
export function metroDmPeerOf(text?: string | null): string | null {
  if (!text) return null;
  const m = new RegExp(LINK_PREFIX + '(?:xmtp\\/)?user\\/(0x[a-fA-F0-9]{40})').exec(text);
  return m?.[1] ?? null;
}

/** Extract the XMTP conversation id from a `metro://xmtp/<convId>` line URI. Anchored to the whole string. Returns null when the line doesn't match. */
export function convIdOfLine(line: string): string | null {
  const m = /^metro:\/\/xmtp\/([^/]+)$/.exec(line);
  return m?.[1] ?? null;
}

/** Find a `metro://xmtp/<convId>` channel link anywhere in text and return the convId (vs convIdOfLine which anchors the whole string), excluding the DM-by-address form via the `(?!user/)` guard so the capture never grabs the literal "user"; null when no channel link. */
export function metroConvIdOf(text?: string | null): string | null {
  if (!text) return null;
  const m = new RegExp(LINK_PREFIX + 'xmtp\\/(?!user\\/)([^\\s/?#]+)').exec(text);
  return m?.[1] ?? null;
}
