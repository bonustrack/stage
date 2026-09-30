import { stageChannelIdOf } from '@stage-labs/client/xmtp/line';
import { routeForUrl } from '@stage-labs/client/routing/deepLinks';
import { reported } from './errorPolicy';

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
  const channel = stageChannelIdOf(url) ? routeForUrl(url) : null;
  if (channel) {
    const { router } = require('expo-router') as typeof import('expo-router');
    router.push(channel);
  } else if (isAllowedLinkScheme(url)) {
    const { Linking } = require('react-native') as typeof import('react-native');
    void Linking.openURL(url).catch(reported('link.open'));
  }
  return false;
}
