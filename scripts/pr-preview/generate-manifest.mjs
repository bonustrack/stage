#!/usr/bin/env node
/** @file Builds a static expo-updates-v1 manifest.json from an `expo export` dir, hashing the bundle and assets with --base-url URLs. */
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

/** Read a dist-relative file into a Buffer. */
const readDist = (rel) => readFileSync(join(dist, rel));

/** launchAsset = the JS/Hermes bundle; fileExtension is omitted per spec. */
const bundleBuf = readDist(fm.bundle);
const launchAsset = {
  key: md5hex(bundleBuf),
  contentType: 'application/javascript',
  url: base + fm.bundle.split('/').map(encodeURIComponent).join('/'),
  hash: sha256url(bundleBuf),
};

/** assets = every bundled image/font, de-duped since metadata.json repeats @Nx variants. */
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
