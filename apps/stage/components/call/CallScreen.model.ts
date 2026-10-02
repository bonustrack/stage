import type { CallStream } from '../../lib/calls.types';

interface CallGrid { cols: number; rows: number }

export function callGrid(count: number, wide: boolean): CallGrid {
  const n = Math.max(1, count);
  const cols = wide ? Math.ceil(Math.sqrt(n)) : n <= 2 ? 1 : 2;
  return { cols, rows: Math.ceil(n / cols) };
}

function twoDigits(n: number): string {
  return String(n).padStart(2, '0');
}

export function callDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1_000));
  const hours = Math.floor(total / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  return hours > 0 ? `${hours}:${twoDigits(minutes)}:${twoDigits(seconds)}` : `${minutes}:${twoDigits(seconds)}`;
}

export function callSubtitle(connected: number, elapsedMs: number): string {
  if (connected === 0) return 'Calling…';
  const people = connected + 1;
  return `${people} people · ${callDuration(elapsedMs)}`;
}

export interface CallMediaViewProps {
  stream: CallStream | null;
  kind: 'video' | 'audio';
  mirrored?: boolean;
  contain?: boolean;
}
