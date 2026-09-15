import { describe, expect, test } from 'bun:test';
import { installsInPlace, releasePageUrl, releaseTag, UPDATE_CHECK_INTERVAL_MS } from '../src/updateModel';

describe('installsInPlace', () => {
  test('windows and linux install downloaded updates themselves', () => {
    expect(installsInPlace('win32')).toBe(true);
    expect(installsInPlace('linux')).toBe(true);
  });

  test('macOS only offers the download until builds carry a Developer ID signature', () => {
    expect(installsInPlace('darwin')).toBe(false);
  });
});

describe('release links', () => {
  test('point at the shared v<version> GitHub release', () => {
    expect(releaseTag('0.1.3')).toBe('v0.1.3');
    expect(releasePageUrl('0.1.3')).toBe('https://github.com/bonustrack/stage/releases/tag/v0.1.3');
  });

  test('checks a few times a day', () => {
    expect(UPDATE_CHECK_INTERVAL_MS).toBe(21_600_000);
  });
});
