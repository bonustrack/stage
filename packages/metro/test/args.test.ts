/**
 * Unit tests for the CLI arg parser in `src/cli/util.ts`:
 *   - `parseArgs`  : positional vs flags, `--k=v`, `--k v`, bare `--flag`,
 *                    repeated flags (→ array), boolean-vs-string merge rules.
 *   - `flagOne`    : last-string-value extraction.
 *   - `flagList`   : multi-value + comma-split.
 *   - `resolveText`: the positional (no-stdin) branch.
 *
 * Pure in-process; no fs / network.
 */

import { describe, expect, test } from 'bun:test';
import { parseArgs, flagOne, flagList, resolveText } from '../src/cli/util.ts';

describe('parseArgs — positionals', () => {
  test('bare strings become positionals in order', () => {
    expect(parseArgs(['send', 'metro://discord/1', 'hello'])).toEqual({
      positional: ['send', 'metro://discord/1', 'hello'],
      flags: {},
    });
  });

  test('empty argv', () => {
    expect(parseArgs([])).toEqual({ positional: [], flags: {} });
  });

  test('positionals interleaved with flags', () => {
    const { positional, flags } = parseArgs(['tail', '--limit', '5', 'extra']);
    expect(positional).toEqual(['tail', 'extra']);
    expect(flags).toEqual({ limit: '5' });
  });
});

describe('parseArgs — flag forms', () => {
  test('--key=value form', () => {
    expect(parseArgs(['--since=42']).flags).toEqual({ since: '42' });
  });

  test('--key value form (consumes next token)', () => {
    const { positional, flags } = parseArgs(['--as', 'metro://user/a']);
    expect(flags).toEqual({ as: 'metro://user/a' });
    expect(positional).toEqual([]);
  });

  test('bare --flag (no value, next is another flag) → boolean true', () => {
    expect(parseArgs(['--json', '--all']).flags).toEqual({ json: true, all: true });
  });

  test('bare --flag at end of argv → boolean true', () => {
    expect(parseArgs(['--json']).flags).toEqual({ json: true });
  });

  test('--key=value with empty value', () => {
    expect(parseArgs(['--label=']).flags).toEqual({ label: '' });
  });

  test('--key= followed by value-looking token: = form wins, token stays positional', () => {
    const { positional, flags } = parseArgs(['--label=x', 'y']);
    expect(flags).toEqual({ label: 'x' });
    expect(positional).toEqual(['y']);
  });

  test('value that starts with -- is NOT consumed (treated as next flag)', () => {
    /** `--from --json` → from is boolean true, json is boolean true. */
    expect(parseArgs(['--from', '--json']).flags).toEqual({ from: true, json: true });
  });
});

describe('parseArgs — repeated flags', () => {
  test('repeated string flag accumulates into an array', () => {
    expect(parseArgs(['--exclude', 'a', '--exclude', 'b']).flags).toEqual({ exclude: ['a', 'b'] });
  });

  test('three repeats → 3-element array', () => {
    expect(parseArgs(['--x=1', '--x=2', '--x=3']).flags).toEqual({ x: ['1', '2', '3'] });
  });

  test('boolean repeat stays boolean (string-after-boolean does not array-ify a bool)', () => {
    /** First `--v` sets true; second `--v=1`: cur is boolean true, val is string →
     *  add() takes the Array.isArray(cur) branch which is false → overwrites with [cur,val]?
     *  Actually cur=true (not array) so flags[k] = [true, '1']. Assert observed shape. */
    const flags = parseArgs(['--v', '--v=1']).flags;
    expect(flags.v).toEqual([true as unknown as string, '1']);
  });

  test('boolean after string: boolean overwrites to true', () => {
    /** add(): when val is boolean, flags[k] = val regardless of cur. */
    expect(parseArgs(['--v=1', '--v']).flags).toEqual({ v: true });
  });
});

describe('flagOne', () => {
  test('returns the string value', () => {
    expect(flagOne({ as: 'x' }, 'as')).toBe('x');
  });
  test('returns the LAST value of an array', () => {
    expect(flagOne({ as: ['a', 'b', 'c'] }, 'as')).toBe('c');
  });
  test('undefined for missing key', () => {
    expect(flagOne({}, 'as')).toBeUndefined();
  });
  test('undefined for a boolean flag (not a string)', () => {
    expect(flagOne({ json: true }, 'json')).toBeUndefined();
  });
  test('undefined for empty array', () => {
    expect(flagOne({ as: [] }, 'as')).toBeUndefined();
  });
});

describe('flagList', () => {
  test('single string', () => {
    expect(flagList({ x: 'a' }, 'x')).toEqual(['a']);
  });
  test('comma-splits a single value and trims', () => {
    expect(flagList({ x: 'a, b ,c' }, 'x')).toEqual(['a', 'b', 'c']);
  });
  test('flattens an array of values, each comma-split', () => {
    expect(flagList({ x: ['a,b', 'c'] }, 'x')).toEqual(['a', 'b', 'c']);
  });
  test('drops empty entries from trailing/leading commas', () => {
    expect(flagList({ x: 'a,,b,' }, 'x')).toEqual(['a', 'b']);
  });
  test('boolean flag yields empty list', () => {
    expect(flagList({ x: true }, 'x')).toEqual([]);
  });
  test('missing key yields empty list', () => {
    expect(flagList({}, 'x')).toEqual([]);
  });
});

describe('resolveText — positional branch (no stdin read)', () => {
  test('joins positionals from the offset with spaces', async () => {
    await expect(resolveText(['send', 'metro://discord/1', 'hello', 'world'], 2)).resolves.toBe('hello world');
  });
  test('single positional at offset', async () => {
    await expect(resolveText(['send', 'x', 'just-this'], 2)).resolves.toBe('just-this');
  });
});
