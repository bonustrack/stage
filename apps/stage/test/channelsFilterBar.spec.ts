import { describe, expect, test } from 'bun:test';
import { channelsFilterBarVisible } from '../components/tabs/HomeScreen.model';

describe('channelsFilterBarVisible', () => {
  test('hides when there are no labels', () => {
    expect(channelsFilterBarVisible({ labelCount: 0, unreadOnly: false, enabledLabelsCount: 0 })).toBe(false);
  });

  test('shows whenever labels exist, with no active filter', () => {
    expect(channelsFilterBarVisible({ labelCount: 1, unreadOnly: false, enabledLabelsCount: 0 })).toBe(true);
  });

  test('stays visible while the unread filter is engaged without labels', () => {
    expect(channelsFilterBarVisible({ labelCount: 0, unreadOnly: true, enabledLabelsCount: 0 })).toBe(true);
  });

  test('stays visible while a label filter is engaged', () => {
    expect(channelsFilterBarVisible({ labelCount: 3, unreadOnly: false, enabledLabelsCount: 1 })).toBe(true);
  });
});
