import { displayHandle } from '@stage-labs/client/identity/stageNames';
import { rowMatchesQuery, type ChannelListRow } from '@stage-labs/client/xmtp/channelsFilter';

export type FilterField = 'label' | 'member' | 'has';

export type FilterScope = 'board' | 'chats';

export const FILTER_FIELDS: readonly FilterField[] = ['label', 'member', 'has'];

export const ME_VALUE = '@me';

interface SearchFilter {
  labels: string[];
  members: string[];
  has: string[];
  text: string;
}

export interface FilterRow extends ChannelListRow {
  inboxToAddr?: Record<string, string>;
  selfInboxId?: string;
}

export interface FilterSpan {
  start: number;
  end: number;
}

export interface FilterOption {
  key: string;
  label: string;
  value: string;
}

export type FilterOptions = Record<FilterField, readonly FilterOption[]>;

export type FilterMenu =
  | { kind: 'fields'; word: FilterSpan; fields: FilterField[] }
  | { kind: 'values'; word: FilterSpan; field: FilterField; options: FilterOption[] };

export type MemberNames = (address: string) => readonly string[];

export const ME_OPTION: FilterOption = { key: ME_VALUE, label: ME_VALUE, value: ME_VALUE };

export const HAS_OPTIONS: readonly FilterOption[] = [
  { key: 'label', label: 'Label', value: 'label' },
  { key: 'draft', label: 'Draft', value: 'draft' },
];

const FIELD_RE = /^(label|member|has):(.*)$/i;
const FILTER_KEYS = { label: 'labels', member: 'members', has: 'has' } as const;

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
    if (ch === '"') quoted = !quoted;
  }
  return words;
}

const unquote = (raw: string): string => raw.replace(/^"/, '').replace(/"$/, '').trim();

function valuesOf(raw: string): string[] {
  const values: string[] = [];
  let from = 0;
  let open = false;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw.charAt(i);
    if (ch === '"') open = !open;
    else if (ch === ',' && !open) {
      values.push(unquote(raw.slice(from, i)));
      from = i + 1;
    }
  }
  values.push(unquote(raw.slice(from)));
  return values;
}

function fieldWord(word: string): { field: FilterField; values: string[] } | null {
  const match = FIELD_RE.exec(word);
  if (match === null) return null;
  const field = FILTER_FIELDS.find(value => value === match[1]?.toLowerCase());
  return field === undefined ? null : { field, values: valuesOf(match[2] ?? '') };
}

const filled = (values: readonly string[]): string[] => values.filter(value => value !== '');

export function parseSearchFilter(query: string): SearchFilter {
  const filter: SearchFilter = { labels: [], members: [], has: [], text: '' };
  const free: string[] = [];
  for (const span of wordsOf(query)) {
    const word = query.slice(span.start, span.end);
    const token = fieldWord(word);
    if (token === null) free.push(word);
    else filter[FILTER_KEYS[token.field]].push(...filled(token.values));
  }
  filter.text = free.join(' ');
  return filter;
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
  return namesOf(address).some(name => bare(name) === wanted);
}

function memberMatches(row: FilterRow, value: string, namesOf: MemberNames): boolean {
  if (isMe(value)) return hasSelf(row);
  return rowMembers(row).some(address => addressMatches(address, value, namesOf));
}

function hasMatches(row: FilterRow, value: string, draftOf: (convId: string) => string): boolean {
  if (value.toLowerCase() === 'label') return (row.labels ?? []).length > 0;
  if (value.toLowerCase() === 'draft') return draftOf(row.convId).trim() !== '';
  return false;
}

export function searchRowMatcher(
  filter: SearchFilter, namesOf: MemberNames, draftOf: (convId: string) => string = () => '',
): (row: FilterRow) => boolean {
  const labels = new Set(filter.labels.map(label => label.toLowerCase()));
  const text = filter.text.toLowerCase();
  const labelled = (row: FilterRow): boolean => (
    labels.size === 0 || (row.labels ?? []).some(label => labels.has(label.toLowerCase()))
  );
  const joined = (row: FilterRow): boolean => (
    filter.members.length === 0 || filter.members.some(value => memberMatches(row, value, namesOf))
  );
  const present = (row: FilterRow): boolean => (
    filter.has.length === 0 || filter.has.some(value => hasMatches(row, value, draftOf))
  );
  return row => labelled(row) && joined(row) && present(row) && rowMatchesQuery(row, text);
}

const IN_SCOPE: Record<FilterScope, (row: FilterRow) => boolean> = {
  board: row => !row.peerAddress && (row.labels ?? []).length > 0,
  chats: () => true,
};

export function searchFilterSources(rows: readonly FilterRow[], scope: FilterScope): { labels: string[]; members: string[] } {
  const labels = new Map<string, string>();
  const members = new Set<string>();
  for (const row of rows) {
    if (!IN_SCOPE[scope](row)) continue;
    for (const label of row.labels ?? []) if (!labels.has(label.toLowerCase())) labels.set(label.toLowerCase(), label);
    for (const address of rowMembers(row)) members.add(address);
  }
  return { labels: [...labels.values()].sort((a, b) => a.localeCompare(b)), members: [...members] };
}

export function memberTokenValue(address: string, handle: string | undefined): string {
  return handle === undefined || handle.trim() === '' ? address.toLowerCase() : bare(displayHandle(handle.trim()));
}

export function memberNames(handle: string | undefined, displayName: string | undefined): string[] {
  return [handle, handle === undefined ? undefined : displayHandle(handle), displayName]
    .filter((name): name is string => name !== undefined && name.trim() !== '');
}

function wordAt(query: string, caret: number): FilterSpan {
  return wordsOf(query).find(span => span.start <= caret && caret <= span.end) ?? { start: caret, end: caret };
}

const optionMatches = (option: FilterOption, needle: string): boolean => (
  option.label.toLowerCase().includes(needle) || option.value.toLowerCase().includes(needle)
);

const withoutWord = (query: string, word: FilterSpan): string => `${query.slice(0, word.start)}${query.slice(word.end)}`;

export function searchFilterValues(query: string, field: FilterField): string[] {
  const filter = parseSearchFilter(query);
  return filter[FILTER_KEYS[field]];
}

const sameValue = (field: FilterField, a: string, b: string): boolean => (
  field === 'member' ? memberKey(a) === memberKey(b) : a.trim().toLowerCase() === b.trim().toLowerCase()
);

export function searchFilterMenu(query: string, caret: number, options: FilterOptions): FilterMenu | null {
  const word = wordAt(query, caret);
  const text = query.slice(word.start, word.end);
  const token = fieldWord(text);
  if (token !== null) {
    const { field } = token;
    const needle = bare(token.values.at(-1) ?? '');
    const picked = [...searchFilterValues(withoutWord(query, word), field), ...filled(token.values.slice(0, -1))];
    const matching = options[field].filter(option => (
      !picked.some(value => sameValue(field, value, option.value)) && optionMatches(option, needle)
    ));
    return matching.length === 0 ? null : { kind: 'values', word, field, options: matching };
  }
  const typed = text.toLowerCase();
  const fields = FILTER_FIELDS.filter(field => field.startsWith(typed));
  return fields.length === 0 ? null : { kind: 'fields', word, fields };
}

export function filterMenuKey(menu: FilterMenu | null): string {
  if (menu === null) return '';
  return `${menu.kind}:${menu.word.start}:${menu.kind === 'values' ? menu.field : ''}`;
}

export function filterMenuSize(menu: FilterMenu | null): number {
  if (menu === null) return 0;
  return menu.kind === 'fields' ? menu.fields.length : menu.options.length;
}

const quoted = (value: string): string => (/[\s",]/.test(value) ? `"${value.replace(/"/g, '')}"` : value);

export function searchFilterToken(field: FilterField, values: readonly string[]): string {
  return `${field}:${values.map(quoted).join(',')}`;
}

function replaceWord(query: string, word: FilterSpan, text: string): { query: string; caret: number } {
  const head = `${query.slice(0, word.start)}${text}`;
  return { query: `${head}${query.slice(word.end)}`, caret: head.length };
}

function appendToToken(query: string, word: FilterSpan, field: FilterField, value: string): { query: string; caret: number } | null {
  const rest = `${query.slice(0, word.start)}${query.slice(word.end).replace(/^\s+/, '')}`;
  for (const span of wordsOf(rest)) {
    const token = fieldWord(rest.slice(span.start, span.end));
    if (token?.field !== field) continue;
    const next = replaceWord(rest, span, searchFilterToken(field, [...filled(token.values), value]));
    return { query: next.query, caret: span.start < word.start ? word.start + next.query.length - rest.length : word.start };
  }
  return null;
}

export function pickSearchFilter(query: string, menu: FilterMenu, index: number): { query: string; caret: number } | null {
  if (menu.kind === 'fields') {
    const field = menu.fields[index];
    return field === undefined ? null : replaceWord(query, menu.word, `${field}:`);
  }
  const option = menu.options[index];
  if (option === undefined) return null;
  const earlier = filled(fieldWord(query.slice(menu.word.start, menu.word.end))?.values.slice(0, -1) ?? []);
  const appended = earlier.length === 0 ? appendToToken(query, menu.word, menu.field, option.value) : null;
  if (appended !== null) return appended;
  const tail = query.slice(menu.word.end).replace(/^\s+/, '');
  const picked = replaceWord(`${query.slice(0, menu.word.end)} ${tail}`, menu.word, searchFilterToken(menu.field, [...earlier, option.value]));
  return { query: picked.query, caret: picked.caret + 1 };
}
