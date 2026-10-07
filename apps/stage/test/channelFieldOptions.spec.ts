import { describe, expect, test } from 'bun:test';
import { configuredFieldOptions } from '../components/channel/channelFieldOptions.model';
import { uniqueKeys } from '../components/conversation/SidebarSection.model';
import { searchFilterSources } from '../components/searchFilter.model';
import { group } from './searchFixtures';

const rows = [
  { ...group('active', []), status: '🚧 In progress', category: 'Stage' },
  { ...group('legacy', []), status: '👀 In review', category: 'Client work' },
  { ...group('review', []), status: '🔍 In review', category: 'Metro' },
  { ...group('duplicate', []), status: '🚧 in progress', category: 'stage' },
];
const sources = searchFilterSources(rows, 'chats');
const statusOrder = ['status:🗒️ Backlog', 'status:🚧 In progress', 'status:🔍 In review', 'status:✅ Done'];
const categoryOrder = ['category:metro', 'category:stage', 'category:Labs'];

describe('configured channel field options', () => {
  test('includes unused statuses in saved board order ahead of observed legacy values', () => {
    expect(configuredFieldOptions('status', sources.statuses, statusOrder)).toEqual([
      '🗒️ Backlog', '🚧 In progress', '🔍 In review', '✅ Done', '👀 In review',
    ]);
  });

  test('includes unused categories in shared board/list order and keeps observed display names', () => {
    expect(configuredFieldOptions('category', sources.categories, categoryOrder)).toEqual([
      'Metro', 'Stage', 'Labs', 'Client work',
    ]);
  });

  test('keeps all configured values when channels are absent or filtered out', () => {
    const filtered = searchFilterSources(rows.filter(row => row.convId === 'active'), 'board');
    expect(configuredFieldOptions('status', filtered.statuses, statusOrder)).toEqual([
      '🗒️ Backlog', '🚧 In progress', '🔍 In review', '✅ Done',
    ]);
    expect(configuredFieldOptions('category', filtered.categories, categoryOrder)).toEqual(['metro', 'Stage', 'Labs']);
    expect(configuredFieldOptions('status', [], statusOrder)).toEqual(statusOrder.map(key => key.slice(7)));
    expect(configuredFieldOptions('category', [], categoryOrder)).toEqual(['metro', 'stage', 'Labs']);
  });

  test('deduplicates case variants without merging different emoji identities or inventing unset values', () => {
    expect(configuredFieldOptions('status', sources.statuses, [
      'status:✅ Done', 'status:✅ done', 'category:Wrong', 'label:Todo', 'status:', 'status:   ', ...statusOrder,
    ])).toEqual(['✅ Done', '🗒️ Backlog', '🚧 In progress', '🔍 In review', '👀 In review']);
    expect(configuredFieldOptions('category', sources.categories, [
      'category:metro', 'category:Metro', 'status:Wrong', 'category:', ...categoryOrder,
    ])).toEqual(['Metro', 'Stage', 'Labs', 'Client work']);
  });

  test('keeps configured order when a different current value is selected', () => {
    const statuses = configuredFieldOptions('status', sources.statuses, statusOrder);
    const categories = configuredFieldOptions('category', sources.categories, categoryOrder);
    expect(uniqueKeys([...statuses, '🚧 In progress'])).toEqual(statuses);
    expect(uniqueKeys([...categories, 'Stage'])).toEqual(categories);
    expect(uniqueKeys([...statuses, 'Custom current'])).toEqual([...statuses, 'Custom current']);
  });

  test('uses observed choices unchanged without configuration and invents no defaults', () => {
    expect(configuredFieldOptions('status', sources.statuses, [])).toEqual(sources.statuses);
    expect(configuredFieldOptions('category', sources.categories, [])).toEqual(sources.categories);
    expect(configuredFieldOptions('status', [], [])).toEqual([]);
    expect(configuredFieldOptions('category', [], [])).toEqual([]);
  });

  test('follows a later configured reorder without mutating source lists', () => {
    const reordered = ['status:✅ Done', 'status:🗒️ Backlog', 'status:🔍 In review', 'status:🚧 In progress'];
    expect(configuredFieldOptions('status', sources.statuses, reordered)).toEqual([
      '✅ Done', '🗒️ Backlog', '🔍 In review', '🚧 In progress', '👀 In review',
    ]);
    expect(configuredFieldOptions('category', sources.categories, [...categoryOrder].reverse())).toEqual([
      'Labs', 'Stage', 'Metro', 'Client work',
    ]);
    expect(statusOrder[0]).toBe('status:🗒️ Backlog');
    expect(sources).toEqual(searchFilterSources(rows, 'chats'));
  });
});
