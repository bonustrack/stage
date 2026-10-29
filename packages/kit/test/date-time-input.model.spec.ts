import { describe, expect, test } from 'bun:test';
import {
  dateTimeMode,
  dayInRange,
  formatWallClock,
  parseWallClock,
  wallClockLabel,
  wrapClock,
} from '../src/react-native/date-time-input.model';

describe('date time input model', () => {
  test('mode falls back to date when nothing is enabled', () => {
    expect(dateTimeMode(undefined, undefined)).toBe('date');
    expect(dateTimeMode(false, true)).toBe('time');
    expect(dateTimeMode(true, true)).toBe('datetime');
  });

  test('parses dates, times and date times as written', () => {
    expect(parseWallClock('2026-02-02')?.date?.getDate()).toBe(2);
    expect(parseWallClock('15:17')).toMatchObject({ date: null, hour: 15, minute: 17 });
    expect(parseWallClock('2026-02-02T15:17:00Z')).toMatchObject({ hour: 15, minute: 17 });
    expect(parseWallClock('2026-02-30')).toBeNull();
    expect(parseWallClock('nope')).toBeNull();
  });

  test('formats ISO strings per mode', () => {
    const d = new Date(2026, 1, 2);
    expect(formatWallClock('date', d, 9, 5)).toBe('2026-02-02');
    expect(formatWallClock('time', null, 9, 5)).toBe('09:05:00');
    expect(formatWallClock('datetime', d, 9, 5)).toBe('2026-02-02T09:05:00');
  });

  test('labels and ranges', () => {
    const clock = parseWallClock('2026-01-02T08:30:00');
    expect(wallClockLabel('date', clock)).toBe('January 2, 2026');
    expect(wallClockLabel('datetime', clock)).toBe('January 2, 2026, 08:30');
    expect(wallClockLabel('time', clock)).toBe('08:30');
    expect(dayInRange(new Date(2026, 0, 1), '2026-01-02', undefined)).toBe(false);
    expect(dayInRange(new Date(2026, 0, 3), '2026-01-02', '2026-01-03')).toBe(true);
    expect(wrapClock(58, 5, 60)).toBe(3);
    expect(wrapClock(0, -1, 24)).toBe(23);
  });
});
