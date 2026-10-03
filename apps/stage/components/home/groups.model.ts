import type { GroupKey } from '@stage-labs/client/xmtp/readState';
import { compareCategoryKeys } from '../../lib/channelGroups.model';
import { compareNames } from '../../lib/format';
import { NO_GROUP_TITLES, groupTitleOf, groupValuesOf, type NameOf } from './groupBy.model';
import type { Row } from './model';

export interface ChannelGroupHeader {
  key: string;
  title: string;
  count: number;
  unread: number;
  collapsed: boolean;
}

interface GroupHeaderItem {
  convId: string;
  header: ChannelGroupHeader;
}

export type HomeListItem = (Row & { listKey?: string }) | GroupHeaderItem;

const DM_GROUP = { key: 'dm', title: 'Direct messages' };
export const NO_GROUP_KEY = 'none';
const HEADER_ID_PREFIX = 'group:';

interface GroupRow {
  convId: string;
  peerAddress: string | null;
  labels?: string[];
  category?: string | null;
  assigned?: string[];
  unreadCount: number;
  markedUnread: boolean;
}

interface Bucket<R> {
  key: string;
  title: string;
  rows: R[];
}

export function isGroupHeader(item: HomeListItem): item is GroupHeaderItem {
  return (item as GroupHeaderItem).header !== undefined;
}

export function rowsOf(items: readonly HomeListItem[]): Row[] {
  return items.filter((item): item is Row => !isGroupHeader(item));
}

export const listKeyOf = (item: HomeListItem): string => (isGroupHeader(item) ? item.convId : item.listKey ?? item.convId);

export const sectionKeyOf = (by: GroupKey, value: string): string => `${by}:${value.toLowerCase()}`;

function bucketsOf(row: GroupRow, by: GroupKey, nameOf: NameOf): { key: string; title: string }[] {
  if (row.peerAddress !== null) return [DM_GROUP];
  const values = groupValuesOf(row, by);
  if (values.length === 0) return [{ key: NO_GROUP_KEY, title: NO_GROUP_TITLES[by] }];
  return values.map(value => ({ key: sectionKeyOf(by, value), title: groupTitleOf(by, value, nameOf) }));
}

function orderedBuckets<R extends GroupRow>(
  rows: readonly R[], by: GroupKey, nameOf: NameOf, order: readonly string[],
): Bucket<R>[] {
  const buckets = new Map<string, Bucket<R>>();
  for (const row of rows) {
    for (const { key, title } of bucketsOf(row, by, nameOf)) {
      let bucket = buckets.get(key);
      if (bucket === undefined) { bucket = { key, title, rows: [] }; buckets.set(key, bucket); }
      bucket.rows.push(row);
    }
  }
  const dm = buckets.get(DM_GROUP.key);
  const none = buckets.get(NO_GROUP_KEY);
  const compareKeys = compareCategoryKeys(order);
  const compare = (a: Bucket<R>, b: Bucket<R>): number =>
    (by === 'category' ? compareKeys(a.key, b.key) : compareNames(a.title, b.title));
  const grouped = [...buckets.values()].filter(b => b !== dm && b !== none).sort(compare);
  return [...(dm === undefined ? [] : [dm]), ...grouped, ...(none === undefined ? [] : [none])];
}

function unreadOf(rows: readonly GroupRow[]): number {
  return rows.filter(r => r.unreadCount > 0 || r.markedUnread).length;
}

function uniqueListItems(bucket: Bucket<Row>, seen: Set<string>): HomeListItem[] {
  return bucket.rows.map((row) => {
    if (!seen.has(row.convId)) { seen.add(row.convId); return row; }
    return { ...row, listKey: `${bucket.key}/${row.convId}` };
  });
}

export function groupRows(
  rows: readonly Row[], by: GroupKey, collapsed: ReadonlySet<string>, expandAll: boolean, nameOf: NameOf,
  order: readonly string[] = [],
): HomeListItem[] {
  const seen = new Set<string>();
  return orderedBuckets(rows, by, nameOf, order).flatMap((bucket): HomeListItem[] => {
    const folded = collapsed.has(bucket.key) && !expandAll;
    const header: ChannelGroupHeader = {
      key: bucket.key, title: bucket.title, count: bucket.rows.length, unread: unreadOf(bucket.rows), collapsed: folded,
    };
    return [{ convId: HEADER_ID_PREFIX + bucket.key, header }, ...(folded ? [] : uniqueListItems(bucket, seen))];
  });
}
