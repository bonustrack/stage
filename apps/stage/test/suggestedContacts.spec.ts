import { describe, expect, test } from 'bun:test';
import { SUGGESTED_CONTACTS, suggestedContacts } from '../components/SuggestedContacts.model';

const POOL = ['0xAAaa000000000000000000000000000000000001', '0xBBbb000000000000000000000000000000000002'];

describe('suggestedContacts', () => {
  test('offers every suggestion when none is known', () => {
    expect(suggestedContacts([], null, POOL)).toEqual(POOL);
  });
  test('hides suggestions already chatted with, case-insensitively', () => {
    expect(suggestedContacts(['0xaaaa000000000000000000000000000000000001'], null, POOL)).toEqual([POOL[1]]);
  });
  test('never suggests the active account itself', () => {
    expect(suggestedContacts([], POOL[1]?.toUpperCase() ?? null, POOL)).toEqual([POOL[0]]);
  });
  test('ships one curated suggestion', () => {
    expect(SUGGESTED_CONTACTS).toEqual(['0xB9d6FB23EACaD83c2770a16DcE4280fD4c1A7404']);
  });
});
