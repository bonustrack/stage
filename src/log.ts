/** Pino → stderr. Stdout reserved for command output / --json. */
import pino from 'pino';

export const log = pino({ name: 'metro', level: process.env.METRO_LOG_LEVEL || 'info' }, pino.destination(2));

export const errMsg = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return String(err);
};
