#!/usr/bin/env node
/**
 * eas-deeplink.mjs — turn `eas update --json` output into a dev-client deep link.
 *
 * The dev-client loads a specific EAS Update group via:
 *   <scheme>://expo-development-client/?url=https://u.expo.dev/<projectId>/group/<groupId>
 * (see docs.expo.dev/eas-update/expo-dev-client). We read the group id + project
 * id from the eas-cli JSON and emit `deeplink=<url>` for $GITHUB_OUTPUT.
 *
 * Usage: node eas-deeplink.mjs <eas-update.json>
 */
import { readFileSync } from 'node:fs';

const SCHEME = 'metro'; // dev variant scheme (app.config.js). Prod = 'stage'.

const raw = JSON.parse(readFileSync(process.argv[2], 'utf8'));
// `eas update --json` emits an array of per-platform update records (one per
// platform published). They share a groupId. Tolerate object or array shape.
const records = Array.isArray(raw) ? raw : raw.updates ?? [raw];
const rec = records.find((r) => r?.group) ?? records[0];
const group = rec?.group;
const projectId = rec?.projectId
  ?? rec?.project?.id
  ?? '1707f2db-c2b8-4c91-9341-27b1d57d355f';

if (!group) {
  console.error('eas-deeplink: no group id in eas update output');
  console.error(JSON.stringify(raw).slice(0, 500));
  process.exit(1);
}

const manifestUrl = `https://u.expo.dev/${projectId}/group/${group}`;
const deeplink = `${SCHEME}://expo-development-client/?url=${encodeURIComponent(manifestUrl)}`;
console.log(`deeplink=${deeplink}`);
console.log(`manifest=${manifestUrl}`);
