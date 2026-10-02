import { describe, expect, test } from 'bun:test';
import { chatsTabOpensNewChat } from '../components/tabs/chatsTab.model';

describe('chatsTabOpensNewChat', () => {
  test('Chats on the chats list opens the new chat screen on a small screen', () => {
    expect(chatsTabOpensNewChat('/', false)).toBe(true);
  });

  test('Chats from another tab goes to the chats list first', () => {
    expect(chatsTabOpensNewChat('/contacts', false)).toBe(false);
    expect(chatsTabOpensNewChat('/wallet', false)).toBe(false);
    expect(chatsTabOpensNewChat('/settings', false)).toBe(false);
  });

  test('Chats from a channel goes to the chats list first', () => {
    expect(chatsTabOpensNewChat('/channel/abc', false)).toBe(false);
  });

  test('the wide layout keeps its own Chats behaviour', () => {
    expect(chatsTabOpensNewChat('/', true)).toBe(false);
  });
});
