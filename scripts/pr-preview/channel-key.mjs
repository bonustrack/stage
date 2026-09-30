#!/usr/bin/env bun
import { channelKey } from '../../apps/proxy/src/branchChannel.ts';

const [branch] = process.argv.slice(2);
if (!branch) {
  console.error('usage: bun scripts/pr-preview/channel-key.mjs <branch>');
  process.exit(2);
}
process.stdout.write(channelKey(branch));
