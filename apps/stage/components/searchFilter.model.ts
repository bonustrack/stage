import { displayHandle } from '@stage-labs/client/identity/stageNames';
import { rowMatchesQuery, type ChannelListRow } from '@stage-labs/client/xmtp/channelsFilter';
import { CHANNEL_PRIORITIES, channelFieldOf, type ChannelField } from '@stage-labs/client/xmtp/labels';
import { matchesLastActivity } from './home/activity.model';

export type FilterField = 'label' | 'member' | 'has' | ChannelField;

export type FilterScope = 'board' | 'chats';

export const FILTER_FIELDS: readonly FilterField[] = ['member', 'category', 'status', 'priority', 'label', 'has'];

export const ME_VALUE = '@me';

interface FilterValues {
  labels: string[];
  members: string[];
  categories: string[];
  statuses: string[];
  priorities: string[];
  has: string[];
}

interface SearchFilter extends FilterValues {
  exclude: FilterValues;
  text: string;
}

export interface FilterRow extends ChannelListRow {
  createdTs?: number | null;
  inboxToAddr?: Record<string, string>;
  selfInboxId?: string;
  category?: string | null;
  status?: string | null;
  priority?: string | null;
}

interface FilterSpan {
  start: number;
  end: number;
}

export interface FilterOption {
  key: string;
  label: string;
  value: string;
  aliases?: readonly string[];
}

export type FilterOptions = Record<FilterField, readonly FilterOption[]>;

export type MemberNames = (address: string) => readonly string[];

export const ME_OPTION: FilterOption = { key: ME_VALUE, label: ME_VALUE, value: ME_VALUE };

export const HAS_OPTIONS: readonly FilterOption[] = [
  { key: 'label', label: 'Label', value: 'label' },
  { key: 'draft', label: 'Draft', value: 'draft' },
];

export const PRIORITY_OPTIONS: readonly FilterOption[] = CHANNEL_PRIORITIES.map((value) => ({ key: value, label: value, value }));

const FIELD_RE = /^(-?)(label|member|has|category|status|priority):(.*)$/i;
const FILTER_KEYS = {
  label: 'labels',
  member: 'members',
  has: 'has',
  category: 'categories',
  status: 'statuses',
  priority: 'priorities',
} as const;

function escapedAt(text: string, index: number): boolean {
  let slashes = 0;
  for (let i = index - 1; i >= 0 && text.charAt(i) === '\\'; i -= 1) slashes += 1;
  return slashes % 2 === 1;
}

function wordsOf(query: string): FilterSpan[] {
  const words: FilterSpan[] = [];
  let start = -1;
  let quoted = false;
  for (let i = 0; i <= query.length; i += 1) {
    const ch = query.charAt(i);
    if (i === query.length || (!quoted && /\s/.test(ch))) {
      if (start !== -1) words.push({ start, end: i });
      start = -1;
      quoted = false;
      continue;
    }
    if (start === -1) start = i;
    if (ch === '"' && !escapedAt(query, i)) quoted = !quoted;
  }
  return words;
}

const unquote = (raw: string): string =>
  raw
    .replace(/^"/, '')
    .replace(/"$/, '')
    .replace(/\\(["\\])/g, '$1')
    .trim();

function valuesOf(raw: string): string[] {
  const values: string[] = [];
  let from = 0;
  let open = false;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw.charAt(i);
    if (ch === '"' && !escapedAt(raw, i)) open = !open;
    else if (ch === ',' && !open) {
      values.push(unquote(raw.slice(from, i)));
      from = i + 1;
    }
  }
  values.push(unquote(raw.slice(from)));
  return values;
}

function fieldWord(word: string): { field: FilterField; negated: boolean; values: string[] } | null {
  const match = FIELD_RE.exec(word);
  if (match === null) return null;
  const field = FILTER_FIELDS.find((value) => value === match[2]?.toLowerCase());
  return field === undefined ? null : { field, negated: match[1] === '-', values: valuesOf(match[3] ?? '') };
}

const filled = (values: readonly string[]): string[] => values.filter((value) => value !== '');

const noValues = (): FilterValues => ({ labels: [], members: [], categories: [], statuses: [], priorities: [], has: [] });

function literalWord(word: string): string {
  return word.startsWith('\\') && (word.startsWith('\\\\') || fieldWord(word.slice(1)) !== null) ? word.slice(1) : word;
}

export function parseSearchFilter(query: string): SearchFilter {
  const filter: SearchFilter = { ...noValues(), exclude: noValues(), text: '' };
  const free: string[] = [];
  for (const span of wordsOf(query)) {
    const word = query.slice(span.start, span.end);
    const token = fieldWord(word);
    if (token === null) free.push(literalWord(word));
    else (token.negated ? filter.exclude : filter)[FILTER_KEYS[token.field]].push(...filled(token.values));
  }
  filter.text = free.join(' ');
  return filter;
}

export function searchQueryText(query: string): string {
  let end = 0;
  let text = '';
  for (const span of wordsOf(query)) {
    if (fieldWord(query.slice(span.start, span.end)) === null) continue;
    text += query.slice(end, span.start);
    end = span.end;
  }
  const free = `${text}${query.slice(end)}`.trimStart();
  return wordsOf(free)
    .toReversed()
    .reduce(
      (result, span) => `${result.slice(0, span.start)}${literalWord(free.slice(span.start, span.end))}${result.slice(span.end)}`,
      free,
    );
}

function escapedQueryText(text: string): string {
  return wordsOf(text)
    .toReversed()
    .reduce((result, span) => {
      const word = text.slice(span.start, span.end);
      const escaped = word.startsWith('\\') || fieldWord(word) !== null ? `\\${word}` : word;
      return `${result.slice(0, span.start)}${escaped}${result.slice(span.end)}`;
    }, text);
}

export function setSearchQueryText(query: string, text: string): string {
  const tokens = wordsOf(query)
    .map((span) => query.slice(span.start, span.end))
    .filter((word) => fieldWord(word) !== null);
  return [...tokens, escapedQueryText(text)].filter((part) => part !== '').join(' ');
}

export function selectedSearchFilters(query: string, field: FilterField, negated = false): string[] {
  const filter = parseSearchFilter(query);
  return (negated ? filter.exclude : filter)[FILTER_KEYS[field]];
}

export function searchFilterCount(query: string): number {
  return FILTER_FIELDS.reduce((count, field) => count + searchFilterValues(query, field).length, 0);
}

function formatSearchFilter(filter: SearchFilter, text: string): string {
  return [
    ...FILTER_FIELDS.flatMap((field) =>
      [false, true].flatMap((negated) => {
        const values = (negated ? filter.exclude : filter)[FILTER_KEYS[field]];
        return values.length === 0 ? [] : [searchFilterToken(field, values, negated)];
      }),
    ),
    escapedQueryText(text),
  ]
    .filter((part) => part !== '')
    .join(' ');
}

export function toggleSearchFilter(
  query: string,
  field: FilterField,
  value: string,
  negated = false,
  aliases: readonly string[] = [],
): string {
  const filter = parseSearchFilter(query);
  const key = FILTER_KEYS[field];
  const target = negated ? filter.exclude : filter;
  const matches = (picked: string): boolean => [value, ...aliases].some((alias) => sameSearchFilterValue(field, picked, alias));
  const selected = target[key].some(matches);
  filter[key] = filter[key].filter((picked) => !matches(picked));
  filter.exclude[key] = filter.exclude[key].filter((picked) => !matches(picked));
  if (!selected) target[key].push(value);
  return formatSearchFilter(filter, searchQueryText(query));
}

export function clearQueryFilters(query: string, field?: FilterField): string {
  if (field === undefined) return escapedQueryText(searchQueryText(query));
  const filter = parseSearchFilter(query);
  filter[FILTER_KEYS[field]] = [];
  filter.exclude[FILTER_KEYS[field]] = [];
  return formatSearchFilter(filter, searchQueryText(query));
}

function rowMembers(row: FilterRow): string[] {
  return Object.entries(row.inboxToAddr ?? {})
    .filter(([inboxId]) => inboxId !== row.selfInboxId)
    .map(([, address]) => address.toLowerCase());
}

const bare = (value: string): string => value.trim().replace(/^@/, '').toLowerCase();

const isMe = (value: string): boolean => value.trim().toLowerCase() === ME_VALUE;

const memberKey = (value: string): string => (isMe(value) ? ME_VALUE : bare(value));

function hasSelf(row: FilterRow): boolean {
  return row.selfInboxId !== undefined && Object.keys(row.inboxToAddr ?? {}).includes(row.selfInboxId);
}

function addressMatches(address: string, value: string, namesOf: MemberNames): boolean {
  const wanted = bare(value);
  if (wanted.startsWith('0x')) return address.startsWith(wanted);
  return namesOf(address).some((name) => bare(name) === wanted);
}

function memberMatches(row: FilterRow, value: string, namesOf: MemberNames): boolean {
  if (isMe(value)) return hasSelf(row);
  return rowMembers(row).some((address) => addressMatches(address, value, namesOf));
}

function hasMatches(row: FilterRow, value: string, draftOf: (convId: string) => string): boolean {
  if (value.toLowerCase() === 'label') return (row.labels ?? []).length > 0;
  if (value.toLowerCase() === 'draft') return draftOf(row.convId).trim() !== '';
  return false;
}

const labelMatches = (row: FilterRow, value: string): boolean =>
  (row.labels ?? []).some((label) => label.toLowerCase() === value.toLowerCase());

const metadataMatches = (row: FilterRow, field: ChannelField, value: string): boolean =>
  channelFieldOf(field, row[field])?.toLowerCase() === value.toLowerCase();

export function searchRowMatcher(
  filter: SearchFilter,
  namesOf: MemberNames,
  draftOf: (convId: string) => string = () => '',
  activityCutoff: number | null = null,
): (row: FilterRow) => boolean {
  const text = filter.text.toLowerCase();
  const tests: Record<FilterField, (row: FilterRow, value: string) => boolean> = {
    label: labelMatches,
    member: (row, value) => memberMatches(row, value, namesOf),
    has: (row, value) => hasMatches(row, value, draftOf),
    category: (row, value) => metadataMatches(row, 'category', value),
    status: (row, value) => metadataMatches(row, 'status', value),
    priority: (row, value) => metadataMatches(row, 'priority', value),
  };
  const kept = (row: FilterRow, field: FilterField): boolean => {
    const key = FILTER_KEYS[field];
    const hit = (value: string): boolean => tests[field](row, value);
    return (filter[key].length === 0 || filter[key].some(hit)) && !filter.exclude[key].some(hit);
  };
  return (row) =>
    matchesLastActivity(row, activityCutoff) && FILTER_FIELDS.every((field) => kept(row, field)) && rowMatchesQuery(row, text);
}

const IN_SCOPE: Record<FilterScope, (row: FilterRow) => boolean> = { board: (row) => !row.peerAddress, chats: () => true };

const sortedValues = (values: ReadonlyMap<string, string>): string[] => [...values.values()].sort((a, b) => a.localeCompare(b));

export function searchFilterSources(rows: readonly FilterRow[], scope: FilterScope): Omit<FilterValues, 'has' | 'priorities'> {
  const labels = new Map<string, string>();
  const fields = { category: new Map<string, string>(), status: new Map<string, string>() };
  const members = new Set<string>();
  for (const row of rows) {
    if (!IN_SCOPE[scope](row)) continue;
    for (const label of row.labels ?? []) if (!labels.has(label.toLowerCase())) labels.set(label.toLowerCase(), label);
    for (const field of ['category', 'status'] as const) {
      const value = channelFieldOf(field, row[field]);
      if (value !== null && !fields[field].has(value.toLowerCase())) fields[field].set(value.toLowerCase(), value);
    }
    for (const address of rowMembers(row)) members.add(address);
  }
  return {
    labels: sortedValues(labels),
    members: [...members],
    categories: sortedValues(fields.category),
    statuses: sortedValues(fields.status),
  };
}

export function memberFilterOption(address: string, label: string, names: readonly string[]): FilterOption {
  return { key: address, value: address.toLowerCase(), label, aliases: names };
}

export function searchFilterOptionMatches(field: FilterField, option: FilterOption, value: string): boolean {
  return [option.value, ...(option.aliases ?? [])].some((alias) => sameSearchFilterValue(field, alias, value));
}

export function memberNames(handle: string | undefined, displayName: string | undefined): string[] {
  return [handle, handle === undefined ? undefined : displayHandle(handle), displayName].filter(
    (name): name is string => name !== undefined && name.trim() !== '',
  );
}

export function searchFilterValues(query: string, field: FilterField): string[] {
  const filter = parseSearchFilter(query);
  return [...filter[FILTER_KEYS[field]], ...filter.exclude[FILTER_KEYS[field]]];
}

export const sameSearchFilterValue = (field: FilterField, a: string, b: string): boolean =>
  field === 'member' ? memberKey(a) === memberKey(b) : a.trim().toLowerCase() === b.trim().toLowerCase();

const quoted = (value: string): string => (/[\s",\\]/.test(value) ? `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : value);

export function searchFilterToken(field: FilterField, values: readonly string[], negated = false): string {
  return `${negated ? '-' : ''}${field}:${values.map(quoted).join(',')}`;
}
