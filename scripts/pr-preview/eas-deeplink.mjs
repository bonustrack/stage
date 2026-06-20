#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const SCHEME = 'stage';

const raw = JSON.parse(readFileSync(process.argv[2], 'utf8'));
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
