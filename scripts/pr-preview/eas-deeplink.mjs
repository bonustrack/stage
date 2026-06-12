#!/usr/bin/env node
/**
 * eas-deeplink.mjs — turn `eas update --json` output into a dev-client deep link.
 *
 * FIXED (always-latest) form: the dev-client loads the NEWEST update on a CHANNEL
 * via the channel-name manifest URL, so one deep link per branch never goes stale:
 *   <scheme>://expo-development-client/?url=https://u.expo.dev/<projectId>?channel-name=<channel>
 * (Note: the `/channel/<name>` path form does NOT work — it expects a channel
 * UUID; the working always-latest form is the `?channel-name=` query param,
 * verified against u.expo.dev.) This replaces the old immutable per-publish
 * `/group/<groupId>` link, which pinned one exact commit and forced a fresh link
 * on every push.
 *
 * We still surface the immutable per-commit `/group/<groupId>` link too (as
 * `groupManifest` / `groupDeeplink`) for when you need to pin an exact build.
 *
 * Usage: node eas-deeplink.mjs <eas-update.json> [<channel-name>]
 *   <channel-name> defaults to the update's branch name (the publish workflow
 *   keeps a same-named channel mapped 1:1 to each branch).
 */
import { readFileSync } from 'node:fs';

const SCHEME = 'metro'; // dev variant scheme (app.config.js). Prod = 'stage'.

const raw = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const channelArg = process.argv[3];
// `eas update --json` emits an array of per-platform update records (one per
// platform published). They share a groupId. Tolerate object or array shape.
const records = Array.isArray(raw) ? raw : raw.updates ?? [raw];
const rec = records.find((r) => r?.group) ?? records[0];
const group = rec?.group;
const projectId = rec?.projectId
  ?? rec?.project?.id
  ?? '1707f2db-c2b8-4c91-9341-27b1d57d355f';
// EAS branch the publish targeted; the workflow keeps a same-named channel
// mapped to it, so it doubles as the channel name when none is passed.
const channel = channelArg ?? rec?.branch ?? rec?.branchName;

const link = (manifestUrl) =>
  `${SCHEME}://expo-development-client/?url=${encodeURIComponent(manifestUrl)}`;

// Always-latest channel link (the stable per-branch deep link we want).
if (channel) {
  const manifest = `https://u.expo.dev/${projectId}?channel-name=${channel}`;
  console.log(`deeplink=${link(manifest)}`);
  console.log(`manifest=${manifest}`);
  console.log(`channel=${channel}`);
} else {
  console.error('eas-deeplink: no channel name (arg or branch in update output)');
}

// Immutable per-commit link (pin an exact build) — kept for reference.
if (group) {
  const groupManifest = `https://u.expo.dev/${projectId}/group/${group}`;
  console.log(`groupManifest=${groupManifest}`);
  console.log(`groupDeeplink=${link(groupManifest)}`);
}

if (!channel && !group) {
  console.error('eas-deeplink: neither channel nor group id available');
  console.error(JSON.stringify(raw).slice(0, 500));
  process.exit(1);
}
