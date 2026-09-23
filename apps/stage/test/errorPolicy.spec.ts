import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { attempt, describeError, ignore, ignored, recover, report, reported } from '../lib/errorPolicy';

const PRIVATE_KEY = `0x${'ab'.repeat(32)}`;
const DB_KEY = 'q'.repeat(44);

function captureLogs(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const warn = spyOn(console, 'warn').mockImplementation((line: unknown) => { lines.push(String(line)); });
  const error = spyOn(console, 'error').mockImplementation((line: unknown) => { lines.push(String(line)); });
  return { lines, restore: () => { warn.mockRestore(); error.mockRestore(); } };
}

let restoreLogs: (() => void) | null = null;
afterEach(() => { restoreLogs?.(); restoreLogs = null; });

describe('describeError', () => {
  test('keeps the message and a non-generic error name', () => {
    expect(describeError(new TypeError('bad input'))).toBe('TypeError: bad input');
    expect(describeError(new Error('plain'))).toBe('plain');
    expect(describeError('raw string')).toBe('raw string');
  });

  test('never prints key material', () => {
    const text = describeError(new Error(`signer ${PRIVATE_KEY} and store key ${DB_KEY} rejected`));
    expect(text).not.toContain(PRIVATE_KEY.slice(2));
    expect(text).not.toContain(DB_KEY);
    expect(text).toBe('signer [redacted] and store key [redacted] rejected');
  });
});

describe('report', () => {
  test('logs one scoped line', () => {
    const logs = captureLogs();
    restoreLogs = logs.restore;
    report('home.refresh', new Error('offline'));
    expect(logs.lines).toEqual(['[stage:home.refresh] offline']);
  });

  test('reported and recover log, recover returns the fallback', async () => {
    const logs = captureLogs();
    restoreLogs = logs.restore;
    await Promise.reject(new Error('a')).catch(reported('x.one'));
    const value = await Promise.reject(new Error('b')).catch(recover('x.two', 7));
    expect(value).toBe(7);
    expect(logs.lines).toEqual(['[stage:x.one] a', '[stage:x.two] b']);
  });
});

describe('best effort', () => {
  test('ignored returns the fallback without logging', async () => {
    const logs = captureLogs();
    restoreLogs = logs.restore;
    const value = await Promise.reject(new Error('gone')).catch(ignored<string[]>([], 'cleanup'));
    expect(value).toEqual([]);
    expect(logs.lines).toEqual([]);
  });

  test('attempt swallows sync throws and async rejections', async () => {
    let ran = 0;
    attempt(() => { ran += 1; throw new Error('sync'); }, 'cleanup');
    attempt(async () => { ran += 1; await Promise.resolve(); throw new Error('async'); }, 'ui');
    ignore(Promise.reject(new Error('dropped')), 'cache');
    ignore(null, 'cache');
    await Promise.resolve();
    expect(ran).toBe(2);
  });
});
