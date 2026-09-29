import { displayHandle } from '@stage-labs/client/identity/stageNames';
import { rowMatchesQuery, type ChannelListRow } from '@stage-labs/client/xmtp/channelsFilter';

export type FilterField = 'label' | 'member';

export type FilterScope = 'board' | 'chats';

export const FILTER_FIELDS: readonly FilterField[] = ['label', 'member'];

export const ME_VALUE = '@me';

interface SearchFilter {
  labels: string[];
  members: string[];
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

const FIELD_RE = /^(label|member):(.*)$/i;

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

function fieldWord(word: string): { field: FilterField; value: string } | null {
  const match = FIELD_RE.exec(word);
  if (match === null) return null;
  return { field: match[1]?.toLowerCase() === 'member' ? 'member' : 'label', value: unquote(match[2] ?? '') };
}

export function parseSearchFilter(query: string): SearchFilter {
  const filter: SearchFilter = { labels: [], members: [], text: '' };
  const free: string[] = [];
  for (const span of wordsOf(query)) {
    const word = query.slice(span.start, span.end);
    const token = fieldWord(word);
    if (token === null) free.push(word);
    else if (token.value !== '') (token.field === 'label' ? filter.labels : filter.members).push(token.value);
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

export function searchRowMatcher(filter: SearchFilter, namesOf: MemberNames): (row: FilterRow) => boolean {
  const labels = new Set(filter.labels.map(label => label.toLowerCase()));
  const text = filter.text.toLowerCase();
  const labelled = (row: FilterRow): boolean => (
    labels.size === 0 || (row.labels ?? []).some(label => labels.has(label.toLowerCase()))
  );
  const joined = (row: FilterRow): boolean => (
    filter.members.length === 0 || filter.members.some(value => memberMatches(row, value, namesOf))
  );
  return row => labelled(row) && joined(row) && rowMatchesQuery(row, text);
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

export function searchFilterMenu(query: string, caret: number, options: FilterOptions): FilterMenu | null {
  const word = wordAt(query, caret);
  const text = query.slice(word.start, word.end);
  const token = fieldWord(text);
  if (token !== null) {
    const needle = bare(token.value);
    const matching = options[token.field].filter(option => optionMatches(option, needle));
    return matching.length === 0 ? null : { kind: 'values', word, field: token.field, options: matching };
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

const quoted = (value: string): string => (/[\s"]/.test(value) ? `"${value.replace(/"/g, '')}"` : value);

function replaceWord(query: string, word: FilterSpan, text: string): { query: string; caret: number } {
  const head = `${query.slice(0, word.start)}${text}`;
  return { query: `${head}${query.slice(word.end)}`, caret: head.length };
}

export function searchFilterValues(query: string, field: FilterField): string[] {
  const filter = parseSearchFilter(query);
  return field === 'label' ? filter.labels : filter.members;
}

const sameValue = (field: FilterField, a: string, b: string): boolean => (
  field === 'label' ? a.trim().toLowerCase() === b.trim().toLowerCase() : memberKey(a) === memberKey(b)
);

export function isSearchFilterOn(query: string, field: FilterField, value: string): boolean {
  return searchFilterValues(query, field).some(token => sameValue(field, token, value));
}

export function toggleSearchFilter(query: string, field: FilterField, value: string): string {
  const words = wordsOf(query).map(span => query.slice(span.start, span.end));
  const kept = words.filter((word) => {
    const token = fieldWord(word);
    return token?.field !== field || !sameValue(field, token.value, value);
  });
  if (kept.length === words.length) kept.push(`${field}:${quoted(value)}`);
  return kept.length === 0 ? '' : `${kept.join(' ')} `;
}

const withoutWord = (query: string, word: FilterSpan): string => `${query.slice(0, word.start)}${query.slice(word.end)}`;

export function isFilterOptionPicked(query: string, menu: FilterMenu, option: FilterOption): boolean {
  return menu.kind === 'values' && isSearchFilterOn(withoutWord(query, menu.word), menu.field, option.value);
}

export function pickSearchFilter(query: string, menu: FilterMenu, index: number): { query: string; caret: number } | null {
  if (menu.kind === 'fields') {
    const field = menu.fields[index];
    return field === undefined ? null : replaceWord(query, menu.word, `${field}:`);
  }
  const option = menu.options[index];
  if (option === undefined) return null;
  if (isFilterOptionPicked(query, menu, option)) {
    const next = toggleSearchFilter(withoutWord(query, menu.word), menu.field, option.value);
    return { query: next, caret: next.length };
  }
  const tail = query.slice(menu.word.end).replace(/^\s+/, '');
  const picked = replaceWord(`${query.slice(0, menu.word.end)} ${tail}`, menu.word, `${menu.field}:${quoted(option.value)}`);
  return { query: picked.query, caret: picked.caret + 1 };
}
