import { describe, expect, test } from 'bun:test';
import { releasePageUrl } from '../src/updateModel';

describe('release links', () => {
  test('point at the shared v<version> GitHub release', () => {
    expect(releasePageUrl('0.1.3')).toBe('https://github.com/bonustrack/stage/releases/tag/v0.1.3');
  });
});
