import { describe, expect, test } from 'bun:test';
import { startupRows } from '../components/settings/startupTiming.model';

describe('startup rows', () => {
  test('native splits app start, the JS bundle and the time until the chat list', () => {
    const rows = startupRows({ processStart: 1000, bundleStart: 1420.4, bundleEnd: 1900, chatsShown: 3250 }, false);
    expect(rows).toEqual([
      { label: 'App start to JS', value: '420 ms' },
      { label: 'JS bundle', value: '480 ms' },
      { label: 'Until chat list', value: '2,250 ms' },
    ]);
  });

  test('web counts from navigation start and has no bundle phases', () => {
    expect(startupRows({ chatsShown: 1830 }, true)).toEqual([{ label: 'Until chat list', value: '1,830 ms' }]);
  });

  test('missing, negative or implausible spans are left out', () => {
    expect(startupRows({}, false)).toEqual([]);
    expect(startupRows({ processStart: 5000, bundleStart: 4000, chatsShown: 5000 + 11 * 60_000 }, false)).toEqual([]);
  });
});
