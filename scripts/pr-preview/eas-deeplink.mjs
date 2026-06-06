#!/usr/bin/env node
/**
 * eas-deeplink.mjs — turn `eas update --json` output into a dev-client deep link.
 *
 * Thin CLI wrapper around deeplink.mjs (shared with daemon-watcher.mjs). Emits
 * `deeplink=…` + `manifest=…` for $GITHUB_OUTPUT.
 *
 * Usage: node eas-deeplink.mjs <eas-update.json>
 */
import { readFileSync } from 'node:fs';
import { buildPreviewLinks } from './deeplink.mjs';

const raw = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const { manifest, deeplink } = buildPreviewLinks(raw);
console.log(`deeplink=${deeplink}`);
console.log(`manifest=${manifest}`);
