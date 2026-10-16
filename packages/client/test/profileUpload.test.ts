import { describe, expect, test } from 'bun:test';
import { parsePineappleResponse } from '../src/profile/upload';

describe('avatar upload response', () => {
  test('returns an IPFS URI only for a nonempty CID string', () => {
    expect(parsePineappleResponse({ result: { cid: 'bafybeisyntheticavatar123' } })).toBe('ipfs://bafybeisyntheticavatar123');
  });
  for (const cid of [null, undefined, true, 12, {}, [], ' ', 'https://image.test/avatar', '../avatar']) {
    test(`rejects malformed CID ${JSON.stringify(cid)}`, () => {
      expect(() => parsePineappleResponse({ result: { cid } })).toThrow();
    });
  }
  test('surfaces a service error and rejects unrelated response shapes', () => {
    expect(() => parsePineappleResponse({ error: { message: 'Image too large' } })).toThrow('Image too large');
    expect(() => parsePineappleResponse({ error: { message: {} } })).toThrow();
    expect(() => parsePineappleResponse(null)).toThrow();
  });
});
