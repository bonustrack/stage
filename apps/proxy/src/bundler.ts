const EAS_PROJECT_ID = '1707f2db-c2b8-4c91-9341-27b1d57d355f';
const DEFAULT_RUNTIME_VERSION = '1.0.0';
const DEFAULT_PLATFORM = 'android';

export const BUNDLER_HOST = 'bundler.stage.box';

export function channelFromPath(pathname: string): string | null {
  const segments = pathname.split('/').filter((part) => part.length > 0);
  if (segments.length === 0) return null;
  if (segments.some((part) => part.includes('.'))) return null;
  const channel = segments.join('-').replace(/[^a-zA-Z0-9._-]/g, '');
  return channel.length > 0 ? channel : null;
}

export function isBrowserRequest(request: Request): boolean {
  if (request.headers.has('expo-platform')) return false;
  return (request.headers.get('accept') ?? '').includes('text/html');
}

export function manifestUrl(channel: string, request: Request): string {
  const target = new URL(`https://u.expo.dev/${EAS_PROJECT_ID}`);
  target.searchParams.set('channel-name', channel);
  target.searchParams.set(
    'runtime-version',
    request.headers.get('expo-runtime-version') ?? DEFAULT_RUNTIME_VERSION,
  );
  target.searchParams.set('platform', request.headers.get('expo-platform') ?? DEFAULT_PLATFORM);
  return target.toString();
}

export async function handleBundler(request: Request): Promise<Response> {
  const channel = channelFromPath(new URL(request.url).pathname);
  if (!channel) return fetch(request);
  if (isBrowserRequest(request)) {
    const deepTarget = `https://${BUNDLER_HOST}/${channel}`;
    const launcher = `https://${BUNDLER_HOST}/preview-launcher.html?u=${encodeURIComponent(deepTarget)}`;
    return Response.redirect(launcher, 302);
  }
  const headers = new Headers(request.headers);
  headers.delete('host');
  return fetch(manifestUrl(channel, request), { headers });
}
