import path from 'node:path';

export const APP_SCHEME = 'stage-app';
export const APP_HOST = 'stage.box';
export const APP_HOME = `${APP_SCHEME}://${APP_HOST}/`;

export const ISOLATION_HEADERS: Readonly<Record<string, string>> = {
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-embedder-policy': 'credentialless',
  'cross-origin-resource-policy': 'same-origin',
};

const MIME: Readonly<Record<string, string>> = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  webmanifest: 'application/manifest+json',
  map: 'application/json',
  wasm: 'application/wasm',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  txt: 'text/plain; charset=utf-8',
};

export function mimeFor(file: string): string {
  const ext = path.extname(file).slice(1).toLowerCase();
  return MIME[ext] ?? 'application/octet-stream';
}

export function webFilePath(root: string, pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const relative = decoded.replace(/^\/+/, '') || 'index.html';
  if (relative.split('/').some((segment) => segment === '..' || segment === '')) return null;
  const resolved = path.resolve(root, relative);
  return resolved.startsWith(path.resolve(root) + path.sep) ? resolved : null;
}
