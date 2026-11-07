import { isPermissionError } from './groups';
import { mentionToken } from './mentions';
import { LabelPermissionError, assignedAddresses, categoryOf, labelsOf, parseObject, priorityOf, stringList } from './labels';

export interface AppDataGroup {
  id?: string;
  sync?: () => Promise<unknown>;
  appData: () => Promise<string>;
  updateAppData: (appData: string) => Promise<unknown>;
}

type Blob = Record<string, unknown>;

type Describe = (before: Blob | null, after: Blob | null, key: string) => string[];

interface TagField<V, G extends string> {
  kind: 'list' | 'value';
  read: (raw: unknown) => V;
  empty: V;
  same: (cached: unknown, next: unknown) => boolean;
  describe: Describe;
  noun?: string;
  groupBy?: G;
}

interface HistoryField {
  kind: 'history';
  describe: Describe;
}

function sameList(cached: unknown, next: unknown): boolean {
  return Array.isArray(cached) && Array.isArray(next) && cached.length === next.length && cached.every((value, i) => value === next[i]);
}

function quotedList(items: string[]): string {
  return items.map((item) => `"${item}"`).join(', ');
}

function labelClauses(blobBefore: Blob | null, blobAfter: Blob | null): string[] {
  const before = stringList(blobBefore?.labels);
  const after = stringList(blobAfter?.labels);
  const has = (list: string[], label: string): boolean => list.some((l) => l.toLowerCase() === label.toLowerCase());
  const added = after.filter((l) => !has(before, l));
  const removed = before.filter((l) => !has(after, l));
  return [
    added.length ? `added label${added.length === 1 ? '' : 's'} ${quotedList(added)}` : '',
    removed.length ? `removed label${removed.length === 1 ? '' : 's'} ${quotedList(removed)}` : '',
  ];
}

function assigneesOf(blob: Blob | null): string[] | null {
  if (!blob) return null;
  return blob.assigned === undefined || Array.isArray(blob.assigned) ? assignedAddresses(blob.assigned) : null;
}

function assigneeClauses(blobBefore: Blob | null, blobAfter: Blob | null): string[] {
  const before = assigneesOf(blobBefore);
  const after = assigneesOf(blobAfter);
  if (!before || !after) return [];
  const added = after.filter((address) => !before.includes(address));
  const removed = before.filter((address) => !after.includes(address));
  return [
    added.length ? `assigned ${added.map(mentionToken).join(', ')}` : '',
    removed.length ? `unassigned ${removed.map(mentionToken).join(', ')}` : '',
  ];
}

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function githubClause(blobBefore: Blob | null, blobAfter: Blob | null): string[] {
  const before = trimmed(blobBefore?.github);
  const after = trimmed(blobAfter?.github);
  if (before === after) return [];
  return [after ? `linked ${after.replace(/^https?:\/\/(www\.)?/, '')}` : 'unlinked the GitHub link'];
}

function listField<G extends string>(
  read: (raw: unknown) => string[],
  describe: Describe,
  groupBy: G,
  sameEmpty: boolean,
): TagField<string[], G> {
  return { kind: 'list', read, empty: [], same: (cached, next) => sameList(sameEmpty ? (cached ?? []) : cached, next), describe, groupBy };
}

interface ValueFieldOptions<G extends string> {
  groupBy?: G;
  rejectsUnknown?: boolean;
}

function valueField<V extends string | null, G extends string = never>(
  noun: string,
  read: (raw: unknown) => V,
  { groupBy, rejectsUnknown = false }: ValueFieldOptions<G> = {},
): TagField<V, G> & { kind: 'value'; noun: string; rejectsUnknown: boolean } {
  const describe: Describe = (blobBefore, blobAfter, key) => {
    const before = read(blobBefore?.[key]);
    const after = read(blobAfter?.[key]);
    if (after === null) return before === null ? [] : [`removed ${noun} "${before}"`];
    if (before === after) return [];
    return [before === null ? `set ${noun} "${after}"` : `changed ${noun} to "${after}"`];
  };
  return {
    kind: 'value',
    noun,
    read,
    empty: null as V,
    same: (cached, next) => (cached ?? null) === next,
    describe,
    groupBy,
    rejectsUnknown,
  };
}

const LABELS = listField(labelsOf, labelClauses, 'label', false);
const CATEGORY = valueField('project', categoryOf, { groupBy: 'category' });
const STATUS = valueField('status', categoryOf, { groupBy: 'status' });
const PRIORITY = valueField('priority', priorityOf, { rejectsUnknown: true });
const GITHUB: HistoryField = { kind: 'history', describe: githubClause };
const ASSIGNED = listField(assignedAddresses, assigneeClauses, 'assignee', true);

const CHANNEL_META = { labels: LABELS, category: CATEGORY, status: STATUS, priority: PRIORITY, github: GITHUB, assigned: ASSIGNED };

type Meta = typeof CHANNEL_META;

type TagKey = { [K in keyof Meta]: Meta[K] extends HistoryField ? never : K }[keyof Meta];

type Tags = Pick<Meta, TagKey>;

export type GroupTags = { [K in TagKey]: ReturnType<Tags[K]['read']> };

export type ChannelField = { [K in TagKey]: Tags[K]['kind'] extends 'value' ? K : never }[TagKey];

export type ChannelGroupKey = NonNullable<Tags[TagKey]['groupBy']>;

const META_KEYS = Object.keys(CHANNEL_META) as (keyof Meta)[];

const TAG_FIELDS: Tags = CHANNEL_META;

function isTagKey(key: keyof Meta): key is TagKey {
  return CHANNEL_META[key].kind !== 'history';
}

const TAG_KEYS = META_KEYS.filter(isTagKey);

function isChannelField(key: TagKey): key is ChannelField {
  return TAG_FIELDS[key].kind === 'value';
}

const CHANNEL_FIELDS = TAG_KEYS.filter(isChannelField);

function tagsFrom(value: (key: TagKey) => unknown): GroupTags {
  return Object.fromEntries(TAG_KEYS.map((key) => [key, value(key)])) as GroupTags;
}

export const NO_TAGS: GroupTags = tagsFrom((key) => TAG_FIELDS[key].empty);

export const CHANNEL_FIELD_NOUNS = Object.fromEntries(CHANNEL_FIELDS.map((field) => [field, TAG_FIELDS[field].noun])) as Record<
  ChannelField,
  string
>;

export const CHANNEL_GROUP_KEYS = TAG_KEYS.flatMap((key): ChannelGroupKey[] => {
  const groupBy = TAG_FIELDS[key].groupBy;
  return groupBy === undefined ? [] : [groupBy];
}).sort();

export function channelFieldOf(field: ChannelField, value: unknown): string | null {
  return TAG_FIELDS[field].read(value);
}

export function sameGroupTags(cached: Partial<Record<TagKey, unknown>>, next: GroupTags): boolean {
  return TAG_KEYS.every((key) => TAG_FIELDS[key].same(cached[key], next[key]));
}

export function describeChannelMetaChange(before: Blob | null, after: Blob | null): string[] {
  return META_KEYS.flatMap((key) => CHANNEL_META[key].describe(before, after, key)).filter(Boolean);
}

function parseBlob(appData: string): Blob {
  return parseObject(appData) ?? {};
}

export async function groupTagsOf(group: AppDataGroup | null): Promise<GroupTags> {
  if (!group) return NO_TAGS;
  try {
    const blob = parseBlob(await group.appData());
    return tagsFrom((key) => TAG_FIELDS[key].read(blob[key]));
  } catch {
    return NO_TAGS;
  }
}

export async function groupAssignedOf(group: AppDataGroup | null): Promise<string[]> {
  return group ? TAG_FIELDS.assigned.read(parseBlob(await group.appData()).assigned) : [];
}

function isEditRefused(e: unknown): boolean {
  return e instanceof Error && isPermissionError(e.message);
}

type Patch = (blob: Blob) => Promise<Blob>;

export interface AppDataWriter {
  writeLabels: (group: AppDataGroup, fn: (labels: string[]) => string[]) => Promise<string[]>;
  writeChannelField: (group: AppDataGroup, field: ChannelField, value: string | null, expected?: string | null) => Promise<string | null>;
  writeAssigned: (group: AppDataGroup, assigned: string[], members: () => Promise<string[]>) => Promise<string[]>;
  close: () => void;
}

function makeBlobQueue(): { write: (group: AppDataGroup, patch: Patch) => Promise<void>; close: () => void } {
  const writes = new Map<string | AppDataGroup, Promise<void>>();
  let closed = false;
  const write = async (group: AppDataGroup, patch: Patch): Promise<void> => {
    const key = group.id ?? group;
    const previous = writes.get(key);
    const task = async (): Promise<void> => {
      if (closed) throw new Error('Channel edit canceled.');
      await group.sync?.();
      const existing = parseBlob(await group.appData());
      const changed = await patch(existing);
      const latest = parseBlob(await group.appData());
      if (closed) throw new Error('Channel edit canceled.');
      await group.updateAppData(JSON.stringify({ ...latest, v: 1, ...changed }));
    };
    const pending = previous ? previous.then(task, task) : task();
    writes.set(key, pending);
    try {
      await pending;
    } finally {
      if (writes.get(key) === pending) writes.delete(key);
    }
  };
  return {
    write,
    close: () => {
      closed = true;
      writes.clear();
    },
  };
}

export function createAppDataWriter(): AppDataWriter {
  const queue = makeBlobQueue();
  const writeTags = async (group: AppDataGroup, what: string, patch: (blob: Blob) => Blob): Promise<void> => {
    try {
      await queue.write(group, (existing) => Promise.resolve(patch(existing)));
    } catch (e) {
      if (isEditRefused(e)) throw new LabelPermissionError(what);
      throw e;
    }
  };
  return {
    async writeLabels(group, fn) {
      let next: string[] = [];
      await writeTags(group, 'labels', (existing) => {
        next = labelsOf(fn(labelsOf(existing.labels)));
        return { labels: next };
      });
      return next;
    },
    async writeChannelField(group, field, value, expected) {
      const next = channelFieldOf(field, value);
      const noun = CHANNEL_FIELD_NOUNS[field];
      if (TAG_FIELDS[field].rejectsUnknown && value !== null && value.trim() !== '' && next === null)
        throw new Error(`Choose a valid ${noun}.`);
      await writeTags(group, `the ${noun}`, (existing) => {
        if (
          expected !== undefined &&
          channelFieldOf(field, existing[field])?.toLowerCase() !== channelFieldOf(field, expected)?.toLowerCase()
        ) {
          throw new Error(`The ${noun} changed. Try again.`);
        }
        return { [field]: next ?? undefined };
      });
      return next;
    },
    async writeAssigned(group, assigned, members) {
      const next = assignedAddresses(assigned);
      if (next.length !== new Set(assigned.map((address) => address.trim().toLowerCase())).size) {
        throw new Error('Choose valid channel members.');
      }
      await queue.write(group, async () => {
        const current = new Set(assignedAddresses(await members()));
        if (next.some((address) => !current.has(address))) throw new Error('Assignees must be current channel members.');
        return { assigned: next };
      });
      return next;
    },
    close: queue.close,
  };
}
