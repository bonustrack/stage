import { errorMessage } from '@stage-labs/client/errors';
import { rejectAfter } from '@stage-labs/client/timing';

export type HistorySyncPhase = 'idle' | 'requesting' | 'waiting' | 'done' | 'timeout' | 'error';

export const HISTORY_COPY = {
  notReady: 'Messaging is not ready yet. Try again in a moment.',
  requestSlow: 'Could not reach your other device in time. Check your connection and try again.',
  syncSlow: 'Checking for history took too long. Check your connection and try again.',
  importSlow: 'Importing history took too long. Keep Stage open on both devices and try again.',
  missing: 'No history from your other device has arrived yet. Keep Stage open there and try again.',
  olderVersion: 'Your other device is on an older version of Stage. Update Stage there, then try again.',
  expired: 'That history is no longer available. Try again.',
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
    case 'requesting':
      return 'Asking your other device for history…';
    case 'waiting':
      return WAITING_LABEL;
    case 'done':
      return 'History synced from your other device.';
    case 'timeout':
      return 'No answer from your other device yet. Open Stage there and try again.';
    case 'error':
      return problem ?? HISTORY_COPY.failed;
    default:
      return null;
  }
}

export function historySyncIsActive(phase: HistorySyncPhase): boolean {
  return phase === 'requesting' || phase === 'waiting';
}

export function timeLeftLabel(msLeft: number): string {
  const seconds = Math.max(0, Math.ceil(msLeft / 1_000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')} left`;
}

export function within<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  return rejectAfter(work, ms, () => new HistoryProblem(message));
}
