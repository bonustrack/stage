import { describe, expect, test } from 'bun:test';
import { channelsLoad } from '../components/home/sync.model';

describe('channelsLoad', () => {
  test('loading until rows or an error arrive', () => {
    expect(channelsLoad(null, '')).toEqual({ kind: 'loading' });
  });

  test('an error shows while there is nothing to list', () => {
    expect(channelsLoad(null, 'timed out')).toEqual({ kind: 'failed', error: 'timed out' });
    expect(channelsLoad([], 'timed out')).toEqual({ kind: 'failed', error: 'timed out' });
  });

  test('loaded chats are never hidden behind an older error', () => {
    expect(channelsLoad([{ convId: 'a' }], 'timed out')).toEqual({ kind: 'ready' });
  });

  test('an account with no chats is ready', () => {
    expect(channelsLoad([], '')).toEqual({ kind: 'ready' });
  });
});
