/** Boundary tests for the OpenSea response schema. `getNfts` is network-bound;
 *  we test the pure seam `parseOpenseaResponse`. Unlike etherscan this degrades
 *  gracefully (returns null on drift, so the caller shows an empty grid) - the
 *  test asserts BOTH that valid bodies pass and that drift returns null rather
 *  than vanishing into a wrong-but-typed value. */

import { describe, expect, test } from 'bun:test';
import { parseOpenseaResponse } from '../src/api/opensea.schema';

const okBody = {
  nfts: [
    {
      identifier: '7',
      collection: 'cool-cats',
      contract: '0x1a92f7381b9f03921564a437210bb9396471050c',
      token_standard: 'erc721',
      name: 'Cool Cat #7',
      image_url: 'https://img/7.png',
      opensea_url: 'https://opensea.io/x/7',
    },
  ],
};

describe('parseOpenseaResponse', () => {
  test('accepts the documented { nfts: [...] } envelope', () => {
    const r = parseOpenseaResponse(okBody);
    expect(r?.nfts?.length).toBe(1);
    expect(r?.nfts?.[0]?.identifier).toBe('7');
  });

  test('accepts an empty / no-nfts body', () => {
    expect(parseOpenseaResponse({})).toEqual({});
  });

  test('drifted envelope returns null (logged) - caller degrades to []', () => {
    expect(parseOpenseaResponse({ nfts: 'not-an-array' })).toBeNull();
  });
});
