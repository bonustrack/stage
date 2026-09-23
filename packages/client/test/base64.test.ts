import { describe, expect, test } from 'bun:test';
import { base64ToBytes, base64ToUtf8, bytesToBase64, utf8ToBase64 } from '../src/text/base64';

describe('bytesToBase64', () => {
  test('matches the standard encoding including padding', () => {
    const cases: [string, string][] = [['', ''], ['f', 'Zg=='], ['fo', 'Zm8='], ['foo', 'Zm9v'], ['foob', 'Zm9vYg==']];
    for (const [input, expected] of cases) {
      expect(bytesToBase64(new TextEncoder().encode(input))).toBe(expected);
    }
  });

  test('round-trips payloads larger than one chunk', () => {
    const bytes = Uint8Array.from({ length: 100_000 }, (_, i) => i % 256);
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
  });
});

describe('utf8 base64', () => {
  test('matches Buffer for multibyte text and round-trips', () => {
    const text = 'héllo 👋 wörld';
    expect(utf8ToBase64(text)).toBe(Buffer.from(text, 'utf-8').toString('base64'));
    expect(base64ToUtf8(utf8ToBase64(text))).toBe(text);
  });

  test('rejects bytes that are not valid utf-8', () => {
    expect(() => base64ToUtf8(bytesToBase64(Uint8Array.from([0xff, 0xfe])))).toThrow();
  });
});
