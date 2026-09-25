const EAS_PROJECT_ID = '1707f2db-c2b8-4c91-9341-27b1d57d355f';
const DEFAULT_RUNTIME_VERSION = '1.0.0';
const DEFAULT_PLATFORM = 'android';
const DEFAULT_CHANNEL = 'main';

export const BUNDLER_HOST = 'bundler.stage.box';

const NO_BRANCH_MESSAGE = `No branch in this URL. Load https://${BUNDLER_HOST}/<branch>, for example https://${BUNDLER_HOST}/${DEFAULT_CHANNEL}`;

export function channelFromPath(pathname: string): string | null {
  const segments = pathname.split('/').filter((part) => part.length > 0);
  if (segments.length === 0) return null;
  if (segments.some((part) => part.includes('.'))) return null;
  const channel = segments.join('-').replace(/[^a-zA-Z0-9._-]/g, '');
  return channel.length > 0 ? channel : null;
}

function isExpoClient(request: Request): boolean {
  return request.headers.has('expo-platform');
}

export function isBrowserRequest(request: Request): boolean {
  if (isExpoClient(request)) return false;
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
  const { pathname } = new URL(request.url);
  const expoClient = isExpoClient(request);
  const channel = channelFromPath(pathname) ?? (expoClient && pathname === '/' ? DEFAULT_CHANNEL : null);
  if (!channel) return expoClient ? new Response(NO_BRANCH_MESSAGE, { status: 404 }) : fetch(request);
  if (isBrowserRequest(request)) {
    const deepTarget = `https://${BUNDLER_HOST}/${channel}`;
    const launcher = `https://${BUNDLER_HOST}/preview-launcher.html?u=${encodeURIComponent(deepTarget)}`;
    return Response.redirect(launcher, 302);
  }
  const headers = new Headers(request.headers);
  headers.delete('host');
  return fetch(manifestUrl(channel, request), { headers });
}
