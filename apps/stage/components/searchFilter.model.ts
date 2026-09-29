import { displayHandle } from '@stage-labs/client/identity/stageNames';
import { rowMatchesQuery, type ChannelListRow } from '@stage-labs/client/xmtp/channelsFilter';

export type FilterField = 'label' | 'member' | 'has';

export type FilterScope = 'board' | 'chats';

export const FILTER_FIELDS: readonly FilterField[] = ['label', 'member', 'has'];

const EXCLUDE_FIELDS: readonly FilterField[] = ['label', 'member'];

export const ME_VALUE = '@me';

interface FilterValues {
  labels: string[];
  members: string[];
  has: string[];
}

interface SearchFilter extends FilterValues {
  exclude: FilterValues;
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
  | { kind: 'fields'; word: FilterSpan; negated: boolean; fields: FilterField[] }
  | { kind: 'values'; word: FilterSpan; field: FilterField; negated: boolean; excludeRow: boolean; options: FilterOption[] };

export type MemberNames = (address: string) => readonly string[];

export const ME_OPTION: FilterOption = { key: ME_VALUE, label: ME_VALUE, value: ME_VALUE };

export const HAS_OPTIONS: readonly FilterOption[] = [
  { key: 'label', label: 'Label', value: 'label' },
  { key: 'draft', label: 'Draft', value: 'draft' },
];

const FIELD_RE = /^(-?)(label|member|has):(.*)$/i;
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

function fieldWord(word: string): { field: FilterField; negated: boolean; values: string[] } | null {
  const match = FIELD_RE.exec(word);
  if (match === null) return null;
  const field = FILTER_FIELDS.find(value => value === match[2]?.toLowerCase());
  return field === undefined ? null : { field, negated: match[1] === '-', values: valuesOf(match[3] ?? '') };
}

const filled = (values: readonly string[]): string[] => values.filter(value => value !== '');

const noValues = (): FilterValues => ({ labels: [], members: [], has: [] });

export function parseSearchFilter(query: string): SearchFilter {
  const filter: SearchFilter = { ...noValues(), exclude: noValues(), text: '' };
  const free: string[] = [];
  for (const span of wordsOf(query)) {
    const word = query.slice(span.start, span.end);
    const token = fieldWord(word);
    if (token === null) free.push(word);
    else (token.negated ? filter.exclude : filter)[FILTER_KEYS[token.field]].push(...filled(token.values));
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

const labelMatches = (row: FilterRow, value: string): boolean => (
  (row.labels ?? []).some(label => label.toLowerCase() === value.toLowerCase())
);

export function searchRowMatcher(
  filter: SearchFilter, namesOf: MemberNames, draftOf: (convId: string) => string = () => '',
): (row: FilterRow) => boolean {
  const text = filter.text.toLowerCase();
  const tests: Record<FilterField, (row: FilterRow, value: string) => boolean> = {
    label: labelMatches,
    member: (row, value) => memberMatches(row, value, namesOf),
    has: (row, value) => hasMatches(row, value, draftOf),
  };
  const kept = (row: FilterRow, field: FilterField): boolean => {
    const key = FILTER_KEYS[field];
    const hit = (value: string): boolean => tests[field](row, value);
    return (filter[key].length === 0 || filter[key].some(hit)) && !filter.exclude[key].some(hit);
  };
  return row => FILTER_FIELDS.every(field => kept(row, field)) && rowMatchesQuery(row, text);
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
  return [...filter[FILTER_KEYS[field]], ...filter.exclude[FILTER_KEYS[field]]];
}

const sameValue = (field: FilterField, a: string, b: string): boolean => (
  field === 'member' ? memberKey(a) === memberKey(b) : a.trim().toLowerCase() === b.trim().toLowerCase()
);

export function searchFilterMenu(query: string, caret: number, options: FilterOptions): FilterMenu | null {
  const word = wordAt(query, caret);
  const text = query.slice(word.start, word.end);
  const token = fieldWord(text);
  if (token !== null) {
    const { field, negated } = token;
    const needle = bare(token.values.at(-1) ?? '');
    const picked = [...searchFilterValues(withoutWord(query, word), field), ...filled(token.values.slice(0, -1))];
    const matching = options[field].filter(option => (
      !picked.some(value => sameValue(field, value, option.value)) && optionMatches(option, needle)
    ));
    const excludeRow = !negated && EXCLUDE_FIELDS.includes(field) && token.values.length === 1 && token.values[0] === '';
    return matching.length === 0 ? null : { kind: 'values', word, field, negated, excludeRow, options: matching };
  }
  const negated = text.startsWith('-');
  const typed = text.slice(negated ? 1 : 0).toLowerCase();
  const fields = (negated ? EXCLUDE_FIELDS : FILTER_FIELDS).filter(field => field.startsWith(typed));
  return fields.length === 0 ? null : { kind: 'fields', word, negated, fields };
}

export function filterMenuKey(menu: FilterMenu | null): string {
  if (menu === null) return '';
  return `${menu.kind}:${menu.word.start}:${menu.kind === 'values' ? menu.field : ''}`;
}

export function filterMenuSize(menu: FilterMenu | null): number {
  if (menu === null) return 0;
  return menu.kind === 'fields' ? menu.fields.length : menu.options.length + (menu.excludeRow ? 1 : 0);
}

const quoted = (value: string): string => (/[\s",]/.test(value) ? `"${value.replace(/"/g, '')}"` : value);

const fieldPrefix = (field: FilterField, negated: boolean): string => `${negated ? '-' : ''}${field}:`;

export function searchFilterToken(field: FilterField, values: readonly string[], negated = false): string {
  return `${fieldPrefix(field, negated)}${values.map(quoted).join(',')}`;
}

function replaceWord(query: string, word: FilterSpan, text: string): { query: string; caret: number } {
  const head = `${query.slice(0, word.start)}${text}`;
  return { query: `${head}${query.slice(word.end)}`, caret: head.length };
}

function appendToToken(
  query: string, word: FilterSpan, { field, negated }: { field: FilterField; negated: boolean }, value: string,
): { query: string; caret: number } | null {
  const rest = `${query.slice(0, word.start)}${query.slice(word.end).replace(/^\s+/, '')}`;
  for (const span of wordsOf(rest)) {
    const token = fieldWord(rest.slice(span.start, span.end));
    if (token?.field !== field || token.negated !== negated) continue;
    const next = replaceWord(rest, span, searchFilterToken(field, [...filled(token.values), value], negated));
    return { query: next.query, caret: span.start < word.start ? word.start + next.query.length - rest.length : word.start };
  }
  return null;
}

function pickValue(query: string, menu: Extract<FilterMenu, { kind: 'values' }>, value: string): { query: string; caret: number } {
  const earlier = filled(fieldWord(query.slice(menu.word.start, menu.word.end))?.values.slice(0, -1) ?? []);
  const appended = earlier.length === 0 ? appendToToken(query, menu.word, menu, value) : null;
  if (appended !== null) return appended;
  const tail = query.slice(menu.word.end).replace(/^\s+/, '');
  const token = searchFilterToken(menu.field, [...earlier, value], menu.negated);
  const picked = replaceWord(`${query.slice(0, menu.word.end)} ${tail}`, menu.word, token);
  return { query: picked.query, caret: picked.caret + 1 };
}

export function pickSearchFilter(query: string, menu: FilterMenu, index: number): { query: string; caret: number } | null {
  if (menu.kind === 'fields') {
    const field = menu.fields[index];
    return field === undefined ? null : replaceWord(query, menu.word, fieldPrefix(field, menu.negated));
  }
  if (menu.excludeRow && index === 0) return replaceWord(query, menu.word, fieldPrefix(menu.field, true));
  const option = menu.options[index - (menu.excludeRow ? 1 : 0)];
  return option === undefined ? null : pickValue(query, menu, option.value);
}
