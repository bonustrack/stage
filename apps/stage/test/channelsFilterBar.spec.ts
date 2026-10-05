import { describe, expect, mock, test } from 'bun:test';
import { channelsLabelChips, selectChannelsFilter } from '../components/home/model';

const chips = (unreadOnly = false, barLabels: string[] = [], enabledLabels: string[] = []) => (
  channelsLabelChips({ barLabels, enabledLabels: new Set(enabledLabels), unreadOnly })
);

describe('chat list filter chips', () => {
  test('always offers All and Unread without labels or active filters', () => {
    expect(chips()).toEqual([
      { value: '', label: 'All', selected: true },
      { value: '__unread__', label: 'Unread', selected: false },
    ]);
  });

  test('keeps both chips when Unread is selected with no matching labels', () => {
    expect(chips(true)).toEqual([
      { value: '', label: 'All', selected: false },
      { value: '__unread__', label: 'Unread', selected: true },
    ]);
  });

  test('keeps built-in filters first and preserves label selection', () => {
    expect(chips(false, ['Stage', 'Metro'], ['stage'])).toEqual([
      { value: '', label: 'All', selected: false },
      { value: '__unread__', label: 'Unread', selected: false },
      { value: 'Stage', label: 'Stage', selected: true },
      { value: 'Metro', label: 'Metro', selected: false },
    ]);
    expect(chips(true, ['Stage'], ['stage']).map(chip => chip.selected)).toEqual([false, true, true]);
  });

  test('dispatches All, Unread and custom labels to their own actions', () => {
    const handlers = { onClearAll: mock(), onToggleUnread: mock(), onToggleLabel: mock() };
    for (const chip of chips(false, ['Stage'])) selectChannelsFilter(handlers, chip.value);
    expect(handlers.onClearAll.mock.calls).toEqual([[]]);
    expect(handlers.onToggleUnread.mock.calls).toEqual([[]]);
    expect(handlers.onToggleLabel.mock.calls).toEqual([['Stage']]);
  });
});
