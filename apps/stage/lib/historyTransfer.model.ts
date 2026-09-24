import { errorMessage } from '@stage-labs/client/errors';
import { HistoryProblem } from './historySync.model';

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
const UNREACHABLE = /failed to fetch|network ?error|network request failed|load failed/i;

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
  return UNREACHABLE.test(errorMessage(err)) ? unreachable : fallback;
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
