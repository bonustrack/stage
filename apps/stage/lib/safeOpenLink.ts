import { routeForUrl } from '@stage-labs/client/routing/deepLinks';
import { attempt, reported } from './errorPolicy';

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

function appPath(path: string): string {
  const target = routeForUrl(path);
  if (!target) return path;
  const queryAt = path.indexOf('?');
  const pathname = queryAt === -1 ? path : path.slice(0, queryAt);
  const segments = pathname.split('/').filter(Boolean);
  const params: Record<string, string | undefined> = target.params ?? {};
  const entity = params.convId ?? params.id;
  if (entity ? decodeURIComponent(segments.at(-1) ?? '') !== entity : segments.length > 1) return path;
  const canonical = target.pathname.replace(/\/\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]/g, (_, key: string) => encodeURIComponent(params[key] ?? ''));
  return (canonical || '/') + (queryAt === -1 ? '' : path.slice(queryAt));
}

export function internalLinkPath(url: string): string | null {
  let path: string | null = null;
  attempt(() => {
    const href = url.trim().replace(/^(?:metro|stage):\/\//i, 'https://stage.box/#/');
    if (/[\s<>\\]/.test(href)) return;
    const parsed = new URL(href);
    if (!/^https?:$/.test(parsed.protocol) || parsed.host !== 'stage.box' || parsed.username || parsed.password) return;
    const route = parsed.hash.startsWith('#/') ? parsed.hash.slice(1) : parsed.pathname + parsed.search;
    if (/[#]/.test(route) || /^(?:\/\/|\/expo-development-client\/|\/preview-launcher\.html)/.test(route)) return;
    path = appPath(route);
  }, 'probe');
  return path;
}

export function openInBubbleLink(url: string): boolean {
  const internal = internalLinkPath(url);
  if (internal) {
    const { router } = require('expo-router') as typeof import('expo-router');
    router.push(internal);
  } else if (isAllowedLinkScheme(url)) {
    const { Linking } = require('react-native') as typeof import('react-native');
    void Linking.openURL(url).catch(reported('link.open'));
  }
  return false;
}
