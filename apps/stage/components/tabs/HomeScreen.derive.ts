import { filterChannelRows, sortChannelRows } from '@stage-labs/client/xmtp/channelsFilter';
import type { Row as RowT } from './HomeScreen.helpers';

export interface SortInputs {
  rows: RowT[] | null;
  enabledLabels: Set<string>;
  unreadOnly: boolean;
  pinned: Set<string>;
}

export function deriveSortedRows(i: SortInputs): RowT[] {
  const filtered = filterChannelRows(i.rows ?? [], {
    enabledLabels: i.enabledLabels,
    unreadOnly: i.unreadOnly,
  });
  return sortChannelRows(filtered, i.pinned);
}
