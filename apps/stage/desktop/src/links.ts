import { APP_HOME } from './assets';

export const WEBSITE = 'https://stage.box';
export const DEEP_LINK_SCHEME = 'stage';

export function siteBaseFor(override: string | undefined): string {
  return override !== undefined && override !== '' ? override : APP_HOME;
}

export function deepLinkIn(argv: readonly string[]): string | null {
  return argv.find((arg) => arg.toLowerCase().startsWith(`${DEEP_LINK_SCHEME}://`)) ?? null;
}

const OAUTH_RETURN = /^oauth\/?\?(.*)$/i;
const OAUTH_RETURN_KEYS = ['privy_oauth_code', 'privy_oauth_state', 'privy_oauth_provider'];

function oauthReturnQuery(route: string): string | null {
  const match = OAUTH_RETURN.exec(route);
  if (match === null) return null;
  const given = new URLSearchParams(match[1]);
  const kept = new URLSearchParams();
  for (const key of OAUTH_RETURN_KEYS) {
    const value = given.get(key);
    if (value === null || value === '') return null;
    kept.set(key, value);
  }
  return kept.toString();
}

export function desktopRouteUrl(base: string, link: string): string {
  const match = /^stage:\/\/(.*)$/i.exec(link.trim());
  const route = (match?.[1] ?? '').replace(/^\/+/, '');
  if (route === '') return base;
  const home = base.replace(/\/+$/, '');
  const oauth = oauthReturnQuery(route);
  return oauth === null ? `${home}/#/${route}` : `${home}/?${oauth}`;
}

export function sameSite(url: string, base: string): boolean {
  try {
    const a = new URL(url);
    const b = new URL(base);
    return a.protocol === b.protocol && a.host === b.host;
  } catch {
    return false;
  }
}
