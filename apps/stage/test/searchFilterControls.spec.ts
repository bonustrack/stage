import { describe, expect, test } from 'bun:test';
import {
  FILTER_FIELDS, clearQueryFilters, parseSearchFilter, searchFilterCount, searchQueryText,
  sameSearchFilterValue, selectedSearchFilters, setSearchQueryText, toggleSearchFilter,
} from '../components/searchFilter.model';

describe('separate query and filter controls', () => {
  test('keeps saved positive and excluded filters out of the query input', () => {
    const query = 'member:@me category:Stage -status:"In review" release notes';
    expect(searchQueryText(query)).toBe('release notes');
    const changed = setSearchQueryText(query, 'draft notes ');
    expect(searchQueryText(changed)).toBe('draft notes ');
    expect(parseSearchFilter(changed)).toMatchObject({ members: ['@me'], categories: ['Stage'], exclude: { statuses: ['In review'] }, text: 'draft notes' });
    expect(searchFilterCount(changed)).toBe(3);
  });

  test('clearing query and clearing filters are independent', () => {
    const query = 'category:Stage priority:High release';
    expect(parseSearchFilter(setSearchQueryText(query, ''))).toMatchObject({ categories: ['Stage'], priorities: ['High'], text: '' });
    expect(clearQueryFilters(query)).toBe('release');
    expect(parseSearchFilter(clearQueryFilters(query, 'category'))).toMatchObject({ categories: [], priorities: ['High'], text: 'release' });
  });

  test('toggles every structured field without replacing the free text', () => {
    for (const field of FILTER_FIELDS) {
      const query = toggleSearchFilter('release notes ', field, 'Ready, next');
      expect(selectedSearchFilters(query, field)).toEqual(['Ready, next']);
      expect(searchQueryText(query)).toBe('release notes ');
      expect(toggleSearchFilter(query, field, 'ready, NEXT')).toBe('release notes ');
    }
  });

  test('moves a choice between inclusion and exclusion without contradictions', () => {
    const query = 'status:Todo,Done -status:Blocked release';
    const excluded = toggleSearchFilter(query, 'status', 'todo', true);
    expect(selectedSearchFilters(excluded, 'status')).toEqual(['Done']);
    expect(selectedSearchFilters(excluded, 'status', true)).toEqual(['Blocked', 'todo']);
    expect(selectedSearchFilters(toggleSearchFilter(excluded, 'status', 'TODO', true), 'status', true)).toEqual(['Blocked']);
    expect(parseSearchFilter(clearQueryFilters(excluded, 'status'))).toMatchObject({ statuses: [], exclude: { statuses: [] }, text: 'release' });
  });

  test('member handle aliases toggle the same selection', () => {
    expect(toggleSearchFilter('member:emma123 hello', 'member', '@Emma123')).toBe('hello');
    expect(toggleSearchFilter('member:@me hello', 'member', '@ME')).toBe('hello');
    expect(sameSearchFilterValue('member', '@me', 'me')).toBe(false);
    expect(sameSearchFilterValue('member', '@Emma123', 'emma123')).toBe(true);
    expect(sameSearchFilterValue('category', '@Stage', 'Stage')).toBe(false);
  });

  test('typing field syntax is literal text, not a hidden filter', () => {
    const text = 'status:Done -member:@me label:"In progress"';
    const query = setSearchQueryText('category:Stage', text);
    expect(searchQueryText(query)).toBe(text);
    expect(parseSearchFilter(query)).toMatchObject({ categories: ['Stage'], statuses: [], labels: [], exclude: { members: [] }, text });
    expect(searchFilterCount(query)).toBe(1);
    expect(searchQueryText(toggleSearchFilter(query, 'priority', 'High'))).toBe(text);
    expect(parseSearchFilter(clearQueryFilters(query)).text).toBe(text);
  });

  test('backslashes, quotes and input whitespace survive edits', () => {
    for (const text of ['draft ', 'two  words', 'hello\\world', '\\status:Done', '"two words"']) {
      const query = setSearchQueryText('category:Stage', text);
      expect(searchQueryText(query)).toBe(text);
      expect(searchQueryText(toggleSearchFilter(query, 'priority', 'Low'))).toBe(text);
    }
  });
});
