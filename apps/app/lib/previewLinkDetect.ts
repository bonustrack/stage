/** @file Parser that detects Expo dev-client PR-preview deep links (app-scheme or https launcher) in message text and extracts the wrapped EAS Update group id for the preview-build bubble. */

/** Detects Expo dev-client PR-preview links (app-scheme metro://stage:// or https launcher) in message text and extracts the wrapped, possibly percent-encoded expo url so the bubble renders an "Open preview build" card; pure string parsing, no network. */

export interface PreviewLinkRef {
  /** The full matched deep link, opened verbatim via `Linking.openURL`. */
  url: string;
  /** The EAS Update group id, used for a short subtitle. */
  groupId: string;
  /** First 8 chars of the group id for a compact label. */
  shortGroup: string;
}

/** Matches the app-scheme dev-client link (metro:// or stage://) and the https preview-launcher form, both wrapping a u.expo.dev group update in the `url=` or `u=` query param. */
const RE =
  /(?:(?:metro|stage):\/\/expo-development-client\/\?url=|https?:\/\/(?:metro|stage)\.box\/preview-launcher\.html\?u=)(\S+)/i;

/** Detect the first expo dev-client preview deep link in `text`, or null. */
export function previewLinkOf(text?: string | null): PreviewLinkRef | null {
  if (!text) return null;
  const m = RE.exec(text);
  if (!m) return null;
  const url = m[0];
  const rawInner = m[1];
  if (rawInner === undefined) return null;
  /** The inner expo URL may be raw or percent-encoded; decode defensively. */
  let inner = rawInner;
  try {
    inner = decodeURIComponent(rawInner);
  } catch {
    /* keep raw if it isn't valid percent-encoding */
  }
  const g = /u\.expo\.dev\/[^/\s]+\/group\/([A-Za-z0-9-]+)/i.exec(inner);
  if (!g) return null;
  const groupId = g[1];
  if (groupId === undefined) return null;
  return { url, groupId, shortGroup: groupId.slice(0, 8) };
}
