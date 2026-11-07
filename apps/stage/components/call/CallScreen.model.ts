import type { CallStream } from '../../lib/calls';
import { clockLabel } from '../../lib/format';

export function callGrid(count: number, wide: boolean): { cols: number; rows: number } {
  const n = Math.max(1, count);
  const cols = wide ? Math.ceil(Math.sqrt(n)) : n <= 2 ? 1 : 2;
  return { cols, rows: Math.ceil(n / cols) };
}

export function callSubtitle(connected: number, elapsedMs: number): string {
  if (connected === 0) return 'Calling…';
  return `${connected + 1} people · ${clockLabel(elapsedMs)}`;
}

export interface CallMediaViewProps {
  stream: CallStream | null;
  kind: 'video' | 'audio';
  mirrored?: boolean;
  contain?: boolean;
}
