#!/usr/bin/env node
/**
 * generate-manifest.mjs — turn an `expo export` output dir into a STATIC,
 * expo-updates-v1-conformant manifest.json that the installed dev-client can
 * load directly from a URL (no live Metro server, no EAS Update, no dynamic
 * backend).
 *
 * WHY THIS EXISTS
 * ----------------
 * `expo export` emits `dist/` = `_expo/static/js/<platform>/<entry>.hbc`
 * (the JS/Hermes bundle) + `assets/<contenthash>` files + `metadata.json`
 * (an index of those). It does NOT emit a manifest the dev-client can load.
 *
 * The expo-updates "load from URL" flow (the `…/expo-development-client/?url=`
 * deep link) fetches a MANIFEST from that URL. Per the expo-updates-1 spec a
 * manifest MAY be a bare `application/json` body (multipart is optional), so we
 * can pre-generate it as a plain file and serve it from any static host — here
 * the daemon's python `http.server` behind apk.metro.box, which already maps
 * `.json` → `application/json`. No server-side logic required.
 *
 * This script reads metadata.json, hashes the bundle + each asset, and writes
 * `<dist>/manifest.json` with absolute URLs rooted at --base-url. The dev-client
 * then GETs the bundle + each asset from those same per-PR URLs.
 *
 * Usage:
 *   node generate-manifest.mjs \
 *     --dist <dir> --platform android \
 *     --base-url https://apk.metro.box/pr-preview/<pr>/ \
 *     --runtime-version <rv> [--out <dir>/manifest.json]
 *
 * HARD REQUIREMENT (native): the installed app must have `expo-updates` and its
 * `runtimeVersion` must equal --runtime-version, or the dev-client refuses the
 * manifest. JS-only — native changes still need a fresh APK. See docs.
 */
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);

const dist = args.dist;
const platform = args.platform ?? 'android';
const baseUrl = args['base-url'];
const runtimeVersion = args['runtime-version'];
const out = args.out ?? join(dist, 'manifest.json');

if (!dist || !baseUrl || !runtimeVersion) {
  console.error('missing --dist / --base-url / --runtime-version');
  process.exit(1);
}
const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

/** base64url(sha256(bytes)) — the asset integrity hash the dev-client verifies. */
const sha256url = (buf) =>
  createHash('sha256').update(buf).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
/** md5 hex — the asset `key` (stable cache id), matching expo's own scheme. */
const md5hex = (buf) => createHash('md5').update(buf).digest('hex');

const mimeByExt = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', ttf: 'font/ttf', otf: 'font/otf',
  woff: 'font/woff', woff2: 'font/woff2', json: 'application/json',
};

const metadata = JSON.parse(readFileSync(join(dist, 'metadata.json'), 'utf8'));
const fm = metadata.fileMetadata?.[platform];
if (!fm) {
  console.error(`metadata.json has no fileMetadata for platform "${platform}"`);
  process.exit(1);
}

const readDist = (rel) => readFileSync(join(dist, rel));

// launchAsset = the JS/Hermes bundle. fileExtension is omitted per spec.
const bundleBuf = readDist(fm.bundle);
const launchAsset = {
  key: md5hex(bundleBuf),
  contentType: 'application/javascript',
  url: base + fm.bundle.split('/').map(encodeURIComponent).join('/'),
  hash: sha256url(bundleBuf),
};

// assets = every bundled image/font. De-dupe (metadata.json repeats @Nx variants).
const seen = new Set();
const assets = [];
for (const a of fm.assets ?? []) {
  if (seen.has(a.path)) continue;
  seen.add(a.path);
  const buf = readDist(a.path);
  assets.push({
    key: md5hex(buf),
    contentType: mimeByExt[a.ext] ?? 'application/octet-stream',
    fileExtension: `.${a.ext}`,
    url: base + a.path.split('/').map(encodeURIComponent).join('/'),
    hash: sha256url(buf),
  });
}

const manifest = {
  id: randomUUID(),
  createdAt: new Date().toISOString(),
  runtimeVersion,
  launchAsset,
  assets,
  metadata: {},
  extra: {},
};

writeFileSync(out, JSON.stringify(manifest));
console.error(
  `wrote ${out}: runtimeVersion=${runtimeVersion} bundle=${fm.bundle} assets=${assets.length} base=${base}`,
);
