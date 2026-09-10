export type HistorySyncPhase = 'idle' | 'requesting' | 'waiting' | 'done' | 'timeout' | 'error';

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

function waitingLabel(account: string | undefined): string {
  const where = account === undefined ? 'on this account' : `on ${account}`;
  return `Waiting for your other device. Open Stage there ${where} and keep it in the foreground.`;
}

export function historySyncPhaseLabel(phase: HistorySyncPhase, account?: string): string | null {
  switch (phase) {
    case 'requesting': return 'Asking your other device for history…';
    case 'waiting': return waitingLabel(account);
    case 'done': return 'History synced from your other device.';
    case 'timeout': return 'No answer from your other device yet. Open Stage there and retry, or use Send history with a PIN in its Messenger settings.';
    case 'error': return 'History sync failed. Try again.';
    default: return null;
  }
}

export function historySyncIsActive(phase: HistorySyncPhase): boolean {
  return phase === 'requesting' || phase === 'waiting';
}

export interface HistoryEntry { id: string; firstNs: string }

export function fingerprintOf(entries: readonly HistoryEntry[]): string {
  return entries.map((entry) => `${entry.id}:${entry.firstNs}`).sort().join('|');
}
