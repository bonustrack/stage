#!/usr/bin/env bun
const cmd = process.argv[2];
if (cmd === 'tail') {
  await import('./tail.js');
} else if (cmd === 'mcp') {
  await import('./server.js');
} else {
  process.stderr.write('usage: metro <tail|mcp>\n');
  process.exit(cmd ? 1 : 0);
}

export {};
