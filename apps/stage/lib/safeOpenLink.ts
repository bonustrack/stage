
const ALLOWED_SCHEMES = new Set(['http', 'https', 'mailto', 'metro', 'stage']);

function schemeOf(url: string): string | null {
  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(url.trim());
  const scheme = m?.[1];
  return scheme !== undefined ? scheme.toLowerCase() : null;
}

export function isAllowedLinkScheme(url: string): boolean {
  const scheme = schemeOf(url);
  return scheme !== null && ALLOWED_SCHEMES.has(scheme);
}

export function openInBubbleLink(url: string): boolean {
  if (isAllowedLinkScheme(url)) {
    const { Linking } = require('react-native') as typeof import('react-native');
    void Linking.openURL(url).catch(() => undefined);
  }
  return false;
}
