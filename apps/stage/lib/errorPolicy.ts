import { errorMessage } from '@stage-labs/client/errors';

export type BestEffort = 'cleanup' | 'cache' | 'probe' | 'ui' | 'optional';

const LONG_HEX = /(0x)?[0-9a-fA-F]{64,}/g;
const LONG_BASE64 = /[A-Za-z0-9+/_-]{43,}={0,2}/g;

function redact(text: string): string {
  return text.replace(LONG_HEX, '[redacted]').replace(LONG_BASE64, '[redacted]');
}

export function describeError(err: unknown): string {
  const name = err instanceof Error && err.name !== 'Error' ? `${err.name}: ` : '';
  return redact(`${name}${errorMessage(err)}`);
}

export function report(scope: string, err: unknown): void {
  const line = `[stage:${scope}] ${describeError(err)}`;
  if (process.env.NODE_ENV !== 'production') console.warn(line);
  else console.error(line);
}

export function reported(scope: string): (err: unknown) => void {
  return (err) => { report(scope, err); };
}

export function recover<T>(scope: string, value: T): (err: unknown) => T {
  return (err) => {
    report(scope, err);
    return value;
  };
}

export function ignored<T>(value: T, reason: BestEffort): (err: unknown) => T {
  void reason;
  return () => value;
}

export function ignore(work: PromiseLike<unknown> | null | undefined, reason: BestEffort): void {
  if (work === null || work === undefined) return;
  void Promise.resolve(work).catch(ignored(undefined, reason));
}

export function attempt(run: () => unknown, reason: BestEffort): void {
  try {
    const out = run();
    if (out instanceof Promise) ignore(out, reason);
  } catch (err) {
    void err;
  }
}
