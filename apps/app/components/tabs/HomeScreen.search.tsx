
import type { Row as RowT } from './HomeScreen.helpers';

export { SearchTopnavBar as ChannelsSearchBar } from '../SearchTopnavBar';

export function filterRowsByQuery(rows: RowT[], query: string): RowT[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => {
    const hay = [r.title, r.lastPreview, r.peerAddress ?? '']
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}
