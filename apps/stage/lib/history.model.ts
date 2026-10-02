import { errorMessage } from '@stage-labs/client/errors';

export type HistorySyncPhase = 'idle' | 'requesting' | 'waiting' | 'done' | 'timeout' | 'error';

export const HISTORY_COPY = {
  notReady: 'Messaging is not ready yet. Try again in a moment.',
  requestSlow: 'Could not reach your other device in time. Check your connection and try again.',
  syncSlow: 'Checking for history took too long. Check your connection and try again.',
  importSlow: 'Importing history took too long. Keep Stage open on both devices and try again.',
  missing: 'No history from your other device has arrived yet. Try again, or enter a code from your other device.',
  olderVersion: 'Your other device is on an older version of Stage. Update Stage there, then try again.',
  expired: 'That history is no longer available. Try again, or enter a code from your other device.',
  network: 'Could not reach the history server. Check your connection and try again.',
  failed: 'History sync failed. Try again.',
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
  if (MISSING_ARCHIVE.test(message)) return HISTORY_COPY.missing;
  if (RETIRED_SERVER.test(message)) return HISTORY_COPY.olderVersion;
  if (message.includes(EXPIRED_ARCHIVE)) return HISTORY_COPY.expired;
  if (UNREACHABLE.test(message)) return HISTORY_COPY.network;
  return fallback;
}

const WAITING_LABEL = 'Waiting for your other device. Open Stage there on this account and keep it in the foreground.';

export function historySyncPhaseLabel(phase: HistorySyncPhase, problem?: string | null): string | null {
  switch (phase) {
    case 'requesting': return 'Asking your other device for history…';
    case 'waiting': return WAITING_LABEL;
    case 'done': return 'History synced from your other device.';
    case 'timeout': return 'No answer from your other device yet. Open Stage there and try again, or enter a code from its Settings > Devices and history > Send history to another device.';
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

export const TRANSFER_COPY = {
  invalidCode: 'Enter the 10-character code shown on your other device, like K7M2-9QX4-TR.',
  notFound: 'No history was found for this code. It may be mistyped, already used or expired. On your other device choose Send history again for a new code.',
  wrongCode: 'This code does not unlock that history. Check the code and try again.',
  incompatible: 'That history was sent by a different version of Stage. Update Stage on both devices, then send it again.',
  downloadFailed: 'Could not download the history. Check your connection and try again.',
  uploadFailed: 'Could not upload your history. Check your connection and try again.',
  tooLarge: 'Your history is too large to send with a code.',
  rateLimited: 'Too many attempts from this network. Wait a minute, then try again.',
  prepareSlow: 'Preparing your history took too long. Keep Stage open and try again.',
  uploadSlow: 'Uploading your history took too long. Check your connection and try again.',
  downloadSlow: 'Downloading the history took too long. Check your connection and try again.',
  importSlow: 'Importing the history took too long. Keep Stage open and try again.',
  sendFailed: 'Something went wrong while sending your history. Try again.',
  importFailed: 'Something went wrong while importing the history. Try again.',
} as const;

export const TRANSFER_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_TRANSFER_BYTES = 50_000_000;

const WRONG_KEY = /missing metadata|aes-gcm|aead/i;
const FOREIGN_ARCHIVE = /decode|protobuf|wire type|zstd|unknown frame|invalid data/i;
const TRANSFER_UNREACHABLE = /failed to fetch|network ?error|network request failed|load failed/i;

export function downloadProblem(status: number): string {
  if (status === 404) return TRANSFER_COPY.notFound;
  if (status === 429) return TRANSFER_COPY.rateLimited;
  return TRANSFER_COPY.downloadFailed;
}

export function uploadProblem(status: number): string {
  if (status === 413) return TRANSFER_COPY.tooLarge;
  if (status === 429) return TRANSFER_COPY.rateLimited;
  return TRANSFER_COPY.uploadFailed;
}

export function importProblem(err: unknown): string {
  if (err instanceof HistoryProblem) return err.message;
  const message = errorMessage(err);
  if (WRONG_KEY.test(message)) return TRANSFER_COPY.wrongCode;
  if (FOREIGN_ARCHIVE.test(message)) return TRANSFER_COPY.incompatible;
  return TRANSFER_COPY.importFailed;
}

export function transferProblemMessage(err: unknown, fallback: string, unreachable: string): string {
  if (err instanceof HistoryProblem) return err.message;
  return TRANSFER_UNREACHABLE.test(errorMessage(err)) ? unreachable : fallback;
}

export function transferExpiry(body: unknown, now: number): number {
  const value = typeof body === 'object' && body !== null && 'expiresAt' in body ? body.expiresAt : undefined;
  return typeof value === 'number' && Number.isFinite(value) && value > now ? value : now + TRANSFER_TTL_MS;
}

export type TransferStep =
  | { kind: 'idle' }
  | { kind: 'packing' }
  | { kind: 'locking'; share: number }
  | { kind: 'uploading' }
  | { kind: 'unlocking'; share: number }
  | { kind: 'downloading' }
  | { kind: 'importing' };

function percent(share: number): string {
  return `${Math.min(100, Math.max(0, Math.round(share * 100)))}%`;
}

export function transferStepLabel(step: TransferStep): string | null {
  switch (step.kind) {
    case 'packing': return 'Packing your messages...';
    case 'locking': return `Locking with the code... ${percent(step.share)}`;
    case 'uploading': return 'Uploading...';
    case 'unlocking': return `Unlocking your history... ${percent(step.share)}`;
    case 'downloading': return 'Downloading...';
    case 'importing': return 'Importing your messages...';
    default: return null;
  }
}
