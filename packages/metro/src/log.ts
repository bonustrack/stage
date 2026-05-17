/** Pino → stderr. TTY → pino-pretty (colorized, hostname/pid stripped); else JSON. */
import pino from 'pino';
import pinoPretty from 'pino-pretty';

const stream = process.stderr.isTTY
  ? pinoPretty({ colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname,name', destination: 2 })
  : pino.destination(2);

/** `base: { name }` strips pino's default pid+hostname from JSON output too (not just from the TTY pretty stream). */
export const log = pino({ base: { name: 'metro' }, level: process.env.METRO_LOG_LEVEL || 'info' }, stream);

export const errMsg = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return String(err);
};
