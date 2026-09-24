import { describe, expect, test } from 'bun:test';
import { isFreshBuild, timeAgo } from '../lib/buildInfo.model';

const NOW = Date.parse('2026-09-24T12:00:00Z');

describe('timeAgo', () => {
  test('rounds to the largest unit', () => {
    expect(timeAgo('2026-09-24T11:59:30Z', NOW)).toBe('just now');
    expect(timeAgo('2026-09-24T11:15:00Z', NOW)).toBe('45m ago');
    expect(timeAgo('2026-09-24T09:00:00Z', NOW)).toBe('3h ago');
    expect(timeAgo('2026-09-21T12:00:00Z', NOW)).toBe('3d ago');
  });

  test('an unknown or invalid time gives an empty label', () => {
    expect(timeAgo('', NOW)).toBe('');
    expect(timeAgo('not a date', NOW)).toBe('');
  });
});

describe('isFreshBuild', () => {
  test('a commit from the last half hour is fresh', () => {
    expect(isFreshBuild('2026-09-24T11:40:00Z', NOW)).toBe(true);
    expect(isFreshBuild('2026-09-24T11:00:00Z', NOW)).toBe(false);
    expect(isFreshBuild('', NOW)).toBe(false);
  });
});
