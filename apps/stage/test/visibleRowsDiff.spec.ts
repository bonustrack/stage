import { describe, expect, test } from 'bun:test';
import { visibleRowsDiff } from '../components/home/model';

describe('chat list consent reconcile', () => {
  test('nothing to do when the visible chats match the rows', () => {
    expect(visibleRowsDiff(['a', 'b'], ['b', 'a'])).toEqual({ added: [], gone: [] });
  });

  test('adds newly visible chats and drops hidden ones', () => {
    expect(visibleRowsDiff(['a', 'b'], ['b', 'c'])).toEqual({ added: ['c'], gone: ['a'] });
  });
});
