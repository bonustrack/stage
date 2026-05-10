// Pino → stderr. Stdout is reserved for command output (`metro`'s inbound
// JSON lines, subcommand results, --json) — any stray write there breaks
// parsing. Override level with METRO_LOG_LEVEL.

import pino from 'pino';

export const log = pino(
  { name: 'metro', level: process.env.METRO_LOG_LEVEL || 'info' },
  pino.destination(2),
);

export const errMsg = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return String(err);
};
