import { describe, expect, test } from 'bun:test';
import { english } from 'viem/accounts';
import {
  applyCompletion, completeIfUnique, currentToken, invalidWords, suggestWords, uniqueCompletion,
} from '../components/onboarding/RecoveryPhrase.model';

describe('BIP-39 wordlist shape', () => {
  test('every word is unique in its first four letters, but not its first three', () => {
    const four = new Set(english.map((w) => w.slice(0, 4)));
    expect(four.size).toBe(english.length);
    const three = new Set(english.map((w) => w.slice(0, 3)));
    expect(three.size).toBeLessThan(english.length);
  });
});

describe('currentToken', () => {
  test('reports the word being typed and whether it is finished', () => {
    expect(currentToken('abandon abi')).toEqual({ word: 'abi', complete: false });
    expect(currentToken('abandon ability ')).toEqual({ word: '', complete: true });
    expect(currentToken('')).toEqual({ word: '', complete: true });
    expect(currentToken('ABI')).toEqual({ word: 'abi', complete: false });
  });
});

describe('suggestWords and uniqueCompletion', () => {
  test('three letters can be ambiguous, four never are', () => {
    expect(suggestWords('act')).toEqual(['act', 'action', 'actor', 'actress', 'actual']);
    expect(uniqueCompletion('act')).toBeNull();
    expect(uniqueCompletion('actr')).toBe('actress');
    expect(uniqueCompletion('zoo')).toBe('zoo');
    expect(suggestWords('')).toEqual([]);
    expect(suggestWords('qqq')).toEqual([]);
  });
});

describe('completeIfUnique', () => {
  test('completes while typing forward and never while deleting', () => {
    expect(completeIfUnique('abandon act', 'abandon actr')).toBe('abandon actress ');
    expect(completeIfUnique('abandon actress ', 'abandon actress')).toBe('abandon actress');
    expect(completeIfUnique('abandon ac', 'abandon act')).toBe('abandon act');
    expect(applyCompletion('abandon act', 'actor')).toBe('abandon actor ');
  });
});

describe('invalidWords', () => {
  test('flags finished words outside the list and ignores the one still being typed', () => {
    expect(invalidWords('abandon foo ability ')).toEqual(['foo']);
    expect(invalidWords('abandon foo abil')).toEqual(['foo']);
    expect(invalidWords('abandon ability ')).toEqual([]);
  });
});
