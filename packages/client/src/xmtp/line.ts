/**
 * @file Metro metro:// line-URI build/parse helpers for XMTP conversations and DM-by-address peers.
 */
/**
 * Metro `metro://` line-URI helpers for XMTP conversations and DM peers.
 *
 *  Pure string/regex logic, shared between the RN app (apps/app), the web
 *  client, and the daemon train (packages/metro/examples/xmtp.ts) so every
 *  surface builds + parses lines by one convention. ZERO @xmtp / react-native /
 *  expo imports — this is the framework-agnostic naming layer.
 *
 *  Two line forms:
 *    - `metro://xmtp/<convId>`            a conversation (DM or group), by id
 *    - `metro://xmtp/user/<0xAddress>`    a DM addressed by the PEER's ETH
 *                                         address (conv ids are installation-
 *                                         local, so DMs are shared by address;
 *                                         each side resolves to its own local
 *                                         DM via findOrCreateDmWithIdentity).
 */

/** URI prefix used for inbound XMTP "from" addresses and DM-by-address links. Mirrors the daemon-side train so the rest of the app relies on one convention. */
export const XMTP_USER_PREFIX = 'metro://xmtp/user/';

/** Format a metro-style line URI for an XMTP conversation. */
export function lineOfConv(convId: string): string {
  return `metro://xmtp/${convId}`;
}

/**
 * Shareable link for a 1-1 DM, addressed by the PEER's Ethereum address rather
 *  than a conversation id. DM conversation ids are installation-local and mean
 *  nothing to the recipient, so a DM is shared by peer address — each side
 *  resolves it to their own local DM.
 */
export function lineOfDmPeer(address: string): string {
  return `${XMTP_USER_PREFIX}${address}`;
}

/**
 * The app ships under two brands that share one codebase: Metro (`metro://`,
 *  `metro.box`) and Stage (`stage://`, `stage.box`). A link minted by either
 *  surface must resolve to the same card, so the detectors below accept BOTH
 *  custom schemes and BOTH https hosts (path- or hash-routed).
 */
const LINK_PREFIX =
  // metro:// | stage://  (custom scheme, authority IS the path)
  '(?:(?:metro|stage):\\/\\/' +
  // OR  https://{metro,stage}.box/  optionally hash-routed (#/...)
  '|https?:\\/\\/(?:metro|stage)\\.box\\/(?:#\\/)?)';

/**
 * Extract the peer Ethereum address from a DM-by-address link found ANYWHERE in
 *  a block of text, across both brands and link forms:
 *    metro://xmtp/user/<addr>   stage://xmtp/user/<addr>
 *    https://metro.box/xmtp/user/<addr>   https://stage.box/#/xmtp/user/<addr>
 *    https://metro.box/user/<addr>        (web user-profile permalink)
 *  Returns null when none is present. Checked BEFORE `metroConvIdOf` so the
 *  literal "user" segment is never mistaken for a conversation id.
 */
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

/**
 * Find a `metro://xmtp/<convId>` channel link ANYWHERE in a block of text and
 *  return the convId (vs `convIdOfLine` which anchors the whole string). Used by
 *  the message renderer to surface an inline channel card. Returns null when the
 *  text contains no metro channel link.
 *
 *  Excludes the DM-by-address form `metro://xmtp/user/<addr>` — that's handled
 *  by `metroDmPeerOf`. Without the `(?!user/)` guard the `[^\s/]+` capture would
 *  grab the literal "user" and render a card that resolves nothing.
 */
export function metroConvIdOf(text?: string | null): string | null {
  if (!text) return null;
  const m = new RegExp(LINK_PREFIX + 'xmtp\\/(?!user\\/)([^\\s/?#]+)').exec(text);
  return m?.[1] ?? null;
}
