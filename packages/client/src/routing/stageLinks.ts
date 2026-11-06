export const STAGE_HOST = 'stage.box';

export const STAGE_ORIGIN = `https://${STAGE_HOST}`;

const APP_SCHEME = 'stage';

export const STAGE_SCHEMES = ['metro', APP_SCHEME] as const;

const DEV_CLIENT_LAUNCH = 'expo-development-client';

const PREVIEW_LAUNCHER = 'preview-launcher.html';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

const SCHEMES = STAGE_SCHEMES.join('|');

const HOST = escapeRegExp(STAGE_HOST);

export const STAGE_LINK_START = `(?:(?:${SCHEMES}):\\/\\/|https?:\\/\\/${HOST}\\/(?:#\\/)?)`;

const STAGE_SCHEME_RE = new RegExp(`^(?:${SCHEMES}):\\/\\/`, 'i');

const LINK_SCHEME_RE = new RegExp(`^(?:https?|${SCHEMES}):\\/\\/`, 'i');

const TRAILING_PUNCTUATION_RE = /[.,;:!?)\]}'"`>]+$/;

const PREVIEW_LAUNCH_RE = new RegExp(
  `(?:(?:${SCHEMES}):\\/\\/${escapeRegExp(DEV_CLIENT_LAUNCH)}\\/\\?url=|https?:\\/\\/${HOST}\\/${escapeRegExp(PREVIEW_LAUNCHER)}\\?u=)(\\S+)`,
  'i',
);

const LAUNCH_PATH_RE = new RegExp(`^(?:\\/\\/|\\/${escapeRegExp(DEV_CLIENT_LAUNCH)}\\/|\\/${escapeRegExp(PREVIEW_LAUNCHER)})`);

const DEV_CLIENT_URL_RE = new RegExp(`^[a-z][a-z0-9+.-]*:\\/\\/${escapeRegExp(DEV_CLIENT_LAUNCH)}(\\/|\\?|$)`, 'i');

const OPENABLE_SCHEMES: ReadonlySet<string> = new Set(['http', 'https', 'mailto', ...STAGE_SCHEMES]);

export function isStageSchemeUrl(url: string): boolean {
  return STAGE_SCHEME_RE.test(url.trim());
}

export function isLinkSchemeUrl(text: string): boolean {
  return LINK_SCHEME_RE.test(text);
}

export function toStageWebUrl(url: string): string {
  return url.trim().replace(STAGE_SCHEME_RE, `${STAGE_ORIGIN}/#/`);
}

export function appUrlFor(path: string): string {
  return `${APP_SCHEME}:/${path}`;
}

export function shareUrlFor(path: string): string {
  return `${STAGE_ORIGIN}/#${path}`;
}

export function trimTrailingPunctuation(text: string): string {
  return text.replace(TRAILING_PUNCTUATION_RE, '');
}

export function hasTrailingPunctuation(text: string): boolean {
  return TRAILING_PUNCTUATION_RE.test(text);
}

export function hashRoute(url: string): string | null {
  const at = url.indexOf('#');
  return at === -1 ? null : url.slice(at + 1);
}

export function hashPath(url: string): string | null {
  const route = hashRoute(url);
  return route?.startsWith('/') ? route : null;
}

export function isLaunchPath(route: string): boolean {
  return LAUNCH_PATH_RE.test(route);
}

export function previewLaunchOf(text: string): { url: string; inner: string } | null {
  const m = PREVIEW_LAUNCH_RE.exec(text);
  const inner = m?.[1];
  return m === null || inner === undefined ? null : { url: m[0], inner };
}

export function isAppLaunchUrl(path: string): boolean {
  const url = path.trim();
  if (DEV_CLIENT_URL_RE.test(url)) return true;
  if (/^exp(\+[a-z0-9.-]+)?:\/\//i.test(url) && !url.includes('/--/')) return true;
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^?#]*)/i.exec(url);
  return m !== null && (m[1] ?? '').replace(/\/+$/, '') === '';
}

function schemeOf(url: string): string | null {
  return /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(url.trim())?.[1]?.toLowerCase() ?? null;
}

export function isAllowedLinkScheme(url: string): boolean {
  const scheme = schemeOf(url);
  return scheme !== null && OPENABLE_SCHEMES.has(scheme);
}
