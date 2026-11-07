import { APP_SCHEME } from '@stage-labs/client/endpoints';
import { APP_HOME } from './assets';

const DEEP_LINK = new RegExp(`^${APP_SCHEME}://(.*)$`, 'i');

export function siteBaseFor(override: string | undefined): string {
  return override !== undefined && override !== '' ? override : APP_HOME;
}

export function deepLinkIn(argv: readonly string[]): string | null {
  return argv.find((arg) => arg.toLowerCase().startsWith(`${APP_SCHEME}://`)) ?? null;
}

export function desktopRouteUrl(base: string, link: string): string {
  const match = DEEP_LINK.exec(link.trim());
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
