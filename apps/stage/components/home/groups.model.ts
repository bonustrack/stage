import { categoryOf } from '@stage-labs/client/xmtp/labels';
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

export type HomeListItem = Row | GroupHeaderItem;

export interface ChannelGroupsPrefs {
  grouped: boolean;
  collapsed: string[];
}

export const NO_GROUPS_PREFS: ChannelGroupsPrefs = { grouped: false, collapsed: [] };

const DM_GROUP = { key: 'dm', title: 'Direct messages' };
const NO_CATEGORY_GROUP = { key: 'none', title: 'No category' };
const CATEGORY_KEY_PREFIX = 'category:';
const HEADER_ID_PREFIX = 'group:';

interface GroupRow {
  convId: string;
  peerAddress: string | null;
  category: string | null;
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

function bucketOf(row: GroupRow): { key: string; title: string } {
  if (row.peerAddress !== null) return DM_GROUP;
  const category = categoryOf(row.category);
  if (category === null) return NO_CATEGORY_GROUP;
  return { key: CATEGORY_KEY_PREFIX + category.toLowerCase(), title: category };
}

function orderedBuckets<R extends GroupRow>(rows: readonly R[]): Bucket<R>[] {
  const buckets = new Map<string, Bucket<R>>();
  for (const row of rows) {
    const { key, title } = bucketOf(row);
    let bucket = buckets.get(key);
    if (bucket === undefined) { bucket = { key, title, rows: [] }; buckets.set(key, bucket); }
    bucket.rows.push(row);
  }
  const categories = [...buckets.values()]
    .filter(b => b.key.startsWith(CATEGORY_KEY_PREFIX))
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  const dm = buckets.get(DM_GROUP.key);
  const none = buckets.get(NO_CATEGORY_GROUP.key);
  return [...(dm === undefined ? [] : [dm]), ...categories, ...(none === undefined ? [] : [none])];
}

function unreadOf(rows: readonly GroupRow[]): number {
  return rows.filter(r => r.unreadCount > 0 || r.markedUnread).length;
}

export function groupRowsByCategory(
  rows: readonly Row[], collapsed: ReadonlySet<string>, expandAll: boolean,
): HomeListItem[] {
  return orderedBuckets(rows).flatMap((bucket): HomeListItem[] => {
    const folded = collapsed.has(bucket.key) && !expandAll;
    const header: ChannelGroupHeader = {
      key: bucket.key, title: bucket.title, count: bucket.rows.length, unread: unreadOf(bucket.rows), collapsed: folded,
    };
    return [{ convId: HEADER_ID_PREFIX + bucket.key, header }, ...(folded ? [] : bucket.rows)];
  });
}

export function parseChannelGroupsPrefs(raw: string): ChannelGroupsPrefs {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return NO_GROUPS_PREFS;
    const { grouped, collapsed } = parsed as Partial<Record<keyof ChannelGroupsPrefs, unknown>>;
    return {
      grouped: grouped === true,
      collapsed: Array.isArray(collapsed) ? collapsed.filter((key): key is string => typeof key === 'string') : [],
    };
  } catch {
    return NO_GROUPS_PREFS;
  }
}
