import { branchFromPath, branchPath, channelKey } from './branchChannel.ts';

const EAS_PROJECT_ID = '1707f2db-c2b8-4c91-9341-27b1d57d355f';
const DEFAULT_RUNTIME_VERSION = '1.0.0';
const DEFAULT_PLATFORM = 'android';
const DEFAULT_BRANCH = 'main';
const STATIC_FILES = new Set(['/index.html', '/preview-launcher.html', '/favicon.svg']);

export const BUNDLER_HOST = 'bundler.stage.box';

const NO_BRANCH_MESSAGE = `No branch in this URL. Load https://${BUNDLER_HOST}/<branch>, for example https://${BUNDLER_HOST}/${DEFAULT_BRANCH}`;

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

function branchFromRequest(pathname: string, expoClient: boolean): string | null {
  if (pathname === '/') return expoClient ? DEFAULT_BRANCH : null;
  return STATIC_FILES.has(pathname) ? null : branchFromPath(pathname);
}

export async function handleBundler(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);
  const expoClient = isExpoClient(request);
  const branch = branchFromRequest(pathname, expoClient);
  if (!branch) return expoClient ? new Response(NO_BRANCH_MESSAGE, { status: 404 }) : fetch(request);
  if (isBrowserRequest(request)) {
    const deepTarget = `https://${BUNDLER_HOST}${branchPath(branch)}`;
    const launcher = `https://${BUNDLER_HOST}/preview-launcher.html?u=${encodeURIComponent(deepTarget)}`;
    return Response.redirect(launcher, 302);
  }
  const headers = new Headers(request.headers);
  headers.delete('host');
  return fetch(manifestUrl(channelKey(branch), request), { headers });
}
