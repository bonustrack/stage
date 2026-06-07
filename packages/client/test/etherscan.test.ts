/** Boundary tests for the Etherscan response schema. The live `fetchActivity`
 *  is network-bound, so we test the PURE seam it now routes through:
 *  `parseEtherscanResponse`. Asserts the documented success + empty shapes pass,
 *  and a garbage envelope THROWS loudly instead of being cast through. */

import { describe, expect, test } from 'bun:test';
import { parseEtherscanResponse } from '../src/api/etherscan.schema';
import { okResponse, emptyResponse, garbageResponse } from './fixtures/etherscan-txlist';

describe('parseEtherscanResponse', () => {
  test('accepts a normal success response with tx rows', () => {
    const r = parseEtherscanResponse(okResponse);
    expect(r.status).toBe('1');
    expect(Array.isArray(r.result)).toBe(true);
    expect((r.result as unknown[]).length).toBe(1);
  });

  test('accepts the empty/no-history response (string result)', () => {
    const r = parseEtherscanResponse(emptyResponse);
    expect(r.status).toBe('0');
    expect(typeof r.result).toBe('string');
  });

  test('drifted/garbage envelope THROWS - not silently swallowed', () => {
    expect(() => parseEtherscanResponse(garbageResponse)).toThrow(/boundary:api.etherscan/);
  });

  test('a row missing required fields is rejected', () => {
    const bad = { status: '1', message: 'OK', result: [{ hash: '0x1' }] };
    expect(() => parseEtherscanResponse(bad)).toThrow();
  });
});
