import { BUNDLER_ORIGIN, MAIN_BRANCH, easManifestUrl, previewLauncherUrl } from '@stage-labs/client/endpoints';
import { branchFromPath, branchPath } from './branchChannel.ts';

const DEFAULT_RUNTIME_VERSION = '1.0.0';
const DEFAULT_PLATFORM = 'android';
const DEFAULT_BRANCH = MAIN_BRANCH;
const STATIC_FILES = new Set(['/index.html', '/preview-launcher.html', '/favicon.svg']);

const NO_BRANCH_MESSAGE = `No branch in this URL. Load ${BUNDLER_ORIGIN}/<branch>, for example ${BUNDLER_ORIGIN}/${DEFAULT_BRANCH}`;

function isExpoClient(request: Request): boolean {
  return request.headers.has('expo-platform');
}

export function isBrowserRequest(request: Request): boolean {
  if (isExpoClient(request)) return false;
  return (request.headers.get('accept') ?? '').includes('text/html');
}

export function manifestUrl(branch: string, request: Request): string {
  return easManifestUrl({
    branch,
    runtime: request.headers.get('expo-runtime-version') ?? DEFAULT_RUNTIME_VERSION,
    platform: request.headers.get('expo-platform') ?? DEFAULT_PLATFORM,
  });
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
    return Response.redirect(previewLauncherUrl(`${BUNDLER_ORIGIN}${branchPath(branch)}`), 302);
  }
  const headers = new Headers(request.headers);
  headers.delete('host');
  return fetch(manifestUrl(branch, request), { headers });
}
