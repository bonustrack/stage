import { describe, expect, test } from 'bun:test';
import { channelsFilterBarVisible } from '../components/tabs/HomeScreen.model';

const read = { unreadCount: 0 };
const unread = { unreadCount: 2 };
const marked = { unreadCount: 0, markedUnread: true };

describe('channelsFilterBarVisible', () => {
  test('hides when there are no channels', () => {
    expect(channelsFilterBarVisible({ rows: [], unreadOnly: false, enabledLabelsCount: 0 })).toBe(false);
  });

  test('hides when every channel is read', () => {
    expect(channelsFilterBarVisible({ rows: [read, read], unreadOnly: false, enabledLabelsCount: 0 })).toBe(false);
  });

  test('shows when a channel has unread messages', () => {
    expect(channelsFilterBarVisible({ rows: [read, unread], unreadOnly: false, enabledLabelsCount: 0 })).toBe(true);
  });

  test('shows when a channel is marked unread', () => {
    expect(channelsFilterBarVisible({ rows: [marked], unreadOnly: false, enabledLabelsCount: 0 })).toBe(true);
  });

  test('stays visible while the unread filter is engaged', () => {
    expect(channelsFilterBarVisible({ rows: [read], unreadOnly: true, enabledLabelsCount: 0 })).toBe(true);
  });

  test('stays visible while a label filter is engaged', () => {
    expect(channelsFilterBarVisible({ rows: [], unreadOnly: false, enabledLabelsCount: 1 })).toBe(true);
  });
});
