import {
  deriveBarLabels, filterChannelRows, sortChannelRows, type ChannelListRow,
} from '@stage-labs/client/xmtp/channelsFilter';

export const UNLABELED_TITLE = 'Unlabeled';
export const BOARD_GAP = 12;
export const BOARD_COLUMN_WIDTH = 340;

export interface BoardColumn<T> {
  key: string;
  label: string | null;
  rows: T[];
}

export function boardColumns<T extends ChannelListRow>(rows: T[], pinned: readonly string[]): BoardColumn<T>[] {
  const sorted = sortChannelRows(rows, pinned);
  const labeled = deriveBarLabels(sorted).map((label) => {
    const key = label.toLowerCase();
    return { key: `label:${key}`, label, rows: filterChannelRows(sorted, { enabledLabels: new Set([key]) }) };
  });
  const unlabeled = sorted.filter(r => (r.labels ?? []).length === 0);
  if (unlabeled.length === 0) return labeled;
  return [...labeled, { key: 'unlabeled', label: null, rows: unlabeled }];
}
