import { errorMessage } from '@stage-labs/client/errors';

export type HistorySyncPhase = 'idle' | 'requesting' | 'waiting' | 'done' | 'timeout' | 'error';

export const HISTORY_COPY = {
  notReady: 'Messaging is not ready yet. Try again in a moment.',
  requestSlow: 'Could not reach your other device in time. Check your connection and try again.',
  syncSlow: 'Checking for history took too long. Check your connection and try again.',
  importSlow: 'Importing history took too long. Keep Stage open on both devices and try again.',
  sendSlow: 'Sending history took too long. Check your connection and try again.',
  pinMissing: 'No history from your other device was found for this PIN yet. On the other device choose Send history again and use the new PIN.',
  olderVersion: 'Your other device is on an older version of Stage. Update Stage there, then try again.',
  expired: 'That history is no longer available. On the other device choose Send history again and use the new PIN.',
  network: 'Could not reach the history server. Check your connection and try again.',
  failed: 'History sync failed. Try again.',
  importFailed: 'Something went wrong while importing. Try again.',
  sendFailed: 'Something went wrong while sending. Try again.',
} as const;

export class HistoryProblem extends Error {}

const MISSING_ARCHIVE = /could not find payload/i;
const RETIRED_SERVER = /ephemera\.network|\(400 |x-hmac/i;
const EXPIRED_ARCHIVE = '(404 ';
const UNREACHABLE = /error sending request|failed to fetch|networkerror|load failed/i;

export function isMissingArchive(err: unknown): boolean {
  return MISSING_ARCHIVE.test(errorMessage(err));
}

export function historyProblemMessage(err: unknown, fallback: string): string {
  if (err instanceof HistoryProblem) return err.message;
  const message = errorMessage(err);
  if (MISSING_ARCHIVE.test(message)) return HISTORY_COPY.pinMissing;
  if (RETIRED_SERVER.test(message)) return HISTORY_COPY.olderVersion;
  if (message.includes(EXPIRED_ARCHIVE)) return HISTORY_COPY.expired;
  if (UNREACHABLE.test(message)) return HISTORY_COPY.network;
  return fallback;
}


export const HISTORY_PIN_LENGTH = 6;

export function historyPinFromRandom(bytes: Uint8Array): string {
  let pin = '';
  for (const byte of bytes) {
    if (pin.length >= HISTORY_PIN_LENGTH) break;
    pin += String(byte % 10);
  }
  return pin.padEnd(HISTORY_PIN_LENGTH, '0');
}

export function normalizeHistoryPin(input: string): string {
  return input.replace(/\D/g, '');
}

export function isValidHistoryPin(pin: string): boolean {
  return new RegExp(`^\\d{${HISTORY_PIN_LENGTH}}$`).test(pin);
}

export function formatHistoryPin(pin: string): string {
  return `${pin.slice(0, 3)} ${pin.slice(3)}`.trim();
}

const WAITING_LABEL = 'Waiting for your other device. Open Stage there on this account and keep it in the foreground.';

export function historySyncPhaseLabel(phase: HistorySyncPhase, problem?: string | null): string | null {
  switch (phase) {
    case 'requesting': return 'Asking your other device for history…';
    case 'waiting': return WAITING_LABEL;
    case 'done': return 'History synced from your other device.';
    case 'timeout': return 'No answer from your other device yet. Open Stage there and retry, or use Send history with a PIN in its Messenger settings.';
    case 'error': return problem ?? HISTORY_COPY.failed;
    default: return null;
  }
}

export function historySyncIsActive(phase: HistorySyncPhase): boolean {
  return phase === 'requesting' || phase === 'waiting';
}

export function settleBy<T>(work: Promise<T>, deadline: number, fallback: T, tickMs = 1_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<T>((resolve) => {
    const check = (): void => {
      const left = deadline - Date.now();
      if (left <= 0) { resolve(fallback); return; }
      timer = setTimeout(check, Math.min(tickMs, left));
    };
    check();
  });
  return Promise.race([work, expired]).finally(() => { if (timer !== undefined) clearTimeout(timer); });
}

export function timeLeftLabel(msLeft: number): string {
  const seconds = Math.max(0, Math.ceil(msLeft / 1_000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')} left`;
}

const TIMED_OUT = Symbol('timed out');

export async function within<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  const result = await settleBy<T | typeof TIMED_OUT>(work, Date.now() + ms, TIMED_OUT);
  if (result === TIMED_OUT) throw new HistoryProblem(message);
  return result;
}
