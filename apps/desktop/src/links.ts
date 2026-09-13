import { APP_HOME } from './assets';

export const WEBSITE = 'https://stage.box';
export const DEEP_LINK_SCHEME = 'stage';

export function siteBaseFor(override: string | undefined): string {
  return override !== undefined && override !== '' ? override : APP_HOME;
}

export function deepLinkIn(argv: readonly string[]): string | null {
  return argv.find((arg) => arg.toLowerCase().startsWith(`${DEEP_LINK_SCHEME}://`)) ?? null;
}

export function desktopRouteUrl(base: string, link: string): string {
  const match = /^stage:\/\/(.*)$/i.exec(link.trim());
  const route = (match?.[1] ?? '').replace(/^\/+/, '');
  return route === '' ? base : `${base.replace(/\/+$/, '')}/#/${route}`;
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
