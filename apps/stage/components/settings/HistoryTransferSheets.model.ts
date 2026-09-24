import { formatTransferCode, normalizeTransferCode } from '@stage-labs/client/xmtp/historyTransfer';

export type SendSheetState =
  | { kind: 'preparing' }
  | { kind: 'ready'; code: string; expiresAt: number }
  | { kind: 'failed'; message: string };

export const SEND_COPY = {
  title: 'Send history',
  preparing: 'Preparing your history...',
  preparingHint: 'This can take a moment on a long history. Keep Stage open.',
  howTo: 'On your other device open Settings > Messenger > Receive history with a code, or choose Enter a code while it syncs history after sign in. Enter this code or scan it.',
  failedTitle: 'Could not send history',
} as const;

export const RECEIVE_COPY = {
  title: 'Receive history',
  about: 'Enter the code shown on the device that sent its history. Letters and numbers, dashes optional.',
  placeholder: 'K7M2-9QX4-TR',
  scan: 'Scan the QR code',
  type: 'Type the code instead',
  submit: 'Import history',
  importing: 'Importing history...',
  badScan: 'That QR code is not a Stage history code. Scan the code shown under Send history on your other device.',
} as const;

export function canSubmitCode(input: string): boolean {
  return normalizeTransferCode(input) !== null;
}

export function codeFromScan(text: string): string | null {
  const code = normalizeTransferCode(text.trim());
  return code === null ? null : formatTransferCode(code);
}

export function displayCode(code: string): string {
  return formatTransferCode(code);
}

export function expiryLabel(expiresAt: number, now: number): string {
  const minutes = Math.max(0, Math.ceil((expiresAt - now) / 60_000));
  if (minutes === 0) return 'This code has expired.';
  if (minutes < 60) return `Works once. Expires in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
  const hours = Math.round(minutes / 60);
  return `Works once. Expires in ${hours} hour${hours === 1 ? '' : 's'}.`;
}
