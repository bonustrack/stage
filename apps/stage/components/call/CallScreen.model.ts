import type { CallStream } from '../../lib/calls.types';
import { clockLabel } from '../bubble/audioCard.model';

interface CallGrid { cols: number; rows: number }

export function callGrid(count: number, wide: boolean): CallGrid {
  const n = Math.max(1, count);
  const cols = wide ? Math.ceil(Math.sqrt(n)) : n <= 2 ? 1 : 2;
  return { cols, rows: Math.ceil(n / cols) };
}

export function callSubtitle(connected: number, elapsedMs: number): string {
  if (connected === 0) return 'Calling…';
  const people = connected + 1;
  return `${people} people · ${clockLabel(elapsedMs)}`;
}

export interface CallMediaViewProps {
  stream: CallStream | null;
  kind: 'video' | 'audio';
  mirrored?: boolean;
  contain?: boolean;
}
