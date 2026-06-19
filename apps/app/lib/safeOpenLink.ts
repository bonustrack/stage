/** In-bubble markdown link handler. Peer messages can embed arbitrary hrefs
 *  (`[tap](file:///etc/...)`, `tel:`, app-scheme deep links into other apps),
 *  so we MUST NOT pass a message-author-controlled URL straight to
 *  `Linking.openURL`. This restricts opens to a small allowlist of safe schemes:
 *  web (http/https), mailto, and our own app schemes (metro:// + stage://).
 *
 *  This is deliberately separate from the deep-link router table (lib/deepLinks):
 *  that table only matches our OWN trusted launch URLs. This guard is for
 *  UNTRUSTED inline markdown links rendered inside chat bubbles.
 *
 *  `react-native` is imported lazily (inside openInBubbleLink) so the pure
 *  `isAllowedLinkScheme` predicate stays unit-testable without the RN runtime. */

/** Schemes we are willing to hand to the OS from an untrusted in-bubble link.
 *  Anything else (file:, tel:, content:, intent:, javascript:, other app
 *  schemes) is ignored. */
const ALLOWED_SCHEMES = new Set(['http', 'https', 'mailto', 'metro', 'stage']);

/** Extract the lowercased URL scheme (the part before the first ':'), or null
 *  when the string has no scheme. */
function schemeOf(url: string): string | null {
  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(url.trim());
  const scheme = m?.[1];
  return scheme !== undefined ? scheme.toLowerCase() : null;
}

/** True when `url` uses a scheme we are willing to open from an untrusted link. */
export function isAllowedLinkScheme(url: string): boolean {
  const scheme = schemeOf(url);
  return scheme !== null && ALLOWED_SCHEMES.has(scheme);
}

/** Open an in-bubble markdown link iff its scheme is allowlisted; silently
 *  ignore everything else. Best-effort — never throws. Returns false so the
 *  Markdown renderer doesn't also try to handle the press. */
export function openInBubbleLink(url: string): boolean {
  if (isAllowedLinkScheme(url)) {
    // Lazy require keeps the RN dependency out of the pure predicate's module graph.
    const { Linking } = require('react-native') as typeof import('react-native');
    void Linking.openURL(url).catch(() => undefined);
  }
  return false;
}
