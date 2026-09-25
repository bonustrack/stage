import { deriveBarLabels, sortChannelRows, type ChannelListRow } from '@stage-labs/client/xmtp/channelsFilter';

export const UNLABELED_TITLE = 'Unlabeled';
export const BOARD_GAP = 12;
const COLUMN_MIN_WIDTH = 280;

export interface BoardColumn<T> {
  key: string;
  label: string | null;
  rows: T[];
}

function hasLabel(row: ChannelListRow, key: string): boolean {
  return (row.labels ?? []).some(l => l.toLowerCase() === key);
}

export function boardColumns<T extends ChannelListRow>(rows: T[], pinned: readonly string[]): BoardColumn<T>[] {
  const sorted = sortChannelRows(rows, pinned);
  const labeled = deriveBarLabels(sorted).map((label) => {
    const key = label.toLowerCase();
    return { key: `label:${key}`, label, rows: sorted.filter(r => hasLabel(r, key)) };
  });
  const unlabeled = sorted.filter(r => (r.labels ?? []).length === 0);
  if (unlabeled.length === 0) return labeled;
  return [...labeled, { key: 'unlabeled', label: null, rows: unlabeled }];
}

export function boardColumnWidth(available: number, count: number): number | null {
  if (available <= 0 || count <= 0) return null;
  const fit = Math.floor((available + BOARD_GAP) / (COLUMN_MIN_WIDTH + BOARD_GAP));
  const perRow = Math.max(1, Math.min(count, fit));
  return Math.floor((available - (perRow - 1) * BOARD_GAP) / perRow);
}
