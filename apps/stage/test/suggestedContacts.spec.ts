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
    expect(SUGGESTED_CONTACTS).toEqual(['0xa94Cb9AA3CB82880142ff98706320E1Fb9B31767']);
  });
});
