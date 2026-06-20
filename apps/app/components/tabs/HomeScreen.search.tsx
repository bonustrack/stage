/** @file HomeScreen.search — the pure client-side channel-row text filter (filterRowsByQuery), plus a re-export of the shared SearchTopnavBar as ChannelsSearchBar so Home call sites are unchanged. */

import type { Row as RowT } from './HomeScreen.helpers';

export { SearchTopnavBar as ChannelsSearchBar } from '../SearchTopnavBar';

/** Filter the already-sorted (and archive/label-filtered) rows by a free-text query. Case-insensitive substring match across title, last preview and the DM peer address. Empty/whitespace query returns the input untouched. */
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
