/** Expo dev-client preview deep-link detection for message bubbles. PR-preview
 *  links posted into a channel take one of these forms:
 *    - app scheme   `metro://expo-development-client/?url=<expo url>`
 *                   `stage://expo-development-client/?url=<expo url>`  (Stage brand)
 *    - https launcher  `https://metro.box/preview-launcher.html?u=<expo url>`
 *                      `https://stage.box/preview-launcher.html?u=<expo url>`
 *  The wrapped expo url (the `url`/`u` query param) may be percent-encoded. When
 *  one is present the bubble renders a friendly "Open preview build" card instead
 *  of the raw URL. Pure string parsing - no network - cheap on every render and
 *  testable. */

export interface PreviewLinkRef {
  /** The full matched deep link, opened verbatim via `Linking.openURL`. */
  url: string;
  /** The EAS Update group id, used for a short subtitle. */
  groupId: string;
  /** First 8 chars of the group id for a compact label. */
  shortGroup: string;
}

/** Triggers for the app-scheme dev-client link (metro:// or stage://) and the
 *  https preview-launcher form, both wrapping a u.expo.dev group update. The
 *  wrapped url is the `url=` (app scheme) or `u=` (launcher) query param.
 *  Anything else returns null and renders as before. */
const RE =
  /(?:(?:metro|stage):\/\/expo-development-client\/\?url=|https?:\/\/(?:metro|stage)\.box\/preview-launcher\.html\?u=)(\S+)/i;

/** Detect the first expo dev-client preview deep link in `text`, or null. */
export function previewLinkOf(text?: string | null): PreviewLinkRef | null {
  if (!text) return null;
  const m = RE.exec(text);
  if (!m) return null;
  const url = m[0];
  // The inner expo URL may be raw or percent-encoded; decode defensively.
  let inner = m[1];
  try {
    inner = decodeURIComponent(m[1]);
  } catch {
    /* keep raw if it isn't valid percent-encoding */
  }
  const g = /u\.expo\.dev\/[^/\s]+\/group\/([A-Za-z0-9-]+)/i.exec(inner);
  if (!g) return null;
  const groupId = g[1];
  return { url, groupId, shortGroup: groupId.slice(0, 8) };
}
