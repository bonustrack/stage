
import type { Row as RowT } from './HomeScreen.helpers';
import { filterChannelRows } from '@stage-labs/client/xmtp/channelsFilter';

export { SearchTopnavBar as ChannelsSearchBar } from '../SearchTopnavBar';

export function filterRowsByQuery(rows: RowT[], query: string): RowT[] {
  return filterChannelRows(rows, { query });
}
