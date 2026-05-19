/**
 * Subprocess harness for monitor tests: imports `handleMonitorRequest` from
 * `src/cli/tail.ts`, mounts it on an ephemeral 127.0.0.1 port, then prints the
 * port number on stdout and waits forever.
 *
 * Run via `bun monitor-harness.mjs` so the TypeScript import works without compilation.
 */

import { createServer } from 'node:http';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { handleMonitorRequest } from '../src/cli/tail.ts';

const HISTORY_PATH = process.env.METRO_STATE_DIR
  ? join(process.env.METRO_STATE_DIR, 'history.jsonl')
  : null;

/** Stub emit so /api/messenger/{send,react} can complete during tests. */
function emit(entry) {
  if (HISTORY_PATH) appendFileSync(HISTORY_PATH, JSON.stringify(entry) + '\n');
}

const server = createServer((req, res) => {
  if (!handleMonitorRequest(req, res, emit)) {
    res.writeHead(404).end();
  }
});

server.listen(0, '127.0.0.1', () => {
  const addr = server.address();
  if (!addr || typeof addr === 'string') {
    process.stderr.write('no address\n');
    process.exit(1);
  }
  /** First line of stdout = port. The test harness reads this. */
  process.stdout.write(`${addr.port}\n`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
