import { describe, expect, test } from 'bun:test';
import { english } from 'viem/accounts';
import {
  acceptTypedChar, applyCompletion, completeIfUnique, currentToken, invalidWords, suggestWords, uniqueCompletion,
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

describe('acceptTypedChar', () => {
  test('rejects a character that cannot start any word', () => {
    expect(acceptTypedChar('fr', 'frm')).toBe('fr');
    expect(acceptTypedChar('', 'x')).toBe('');
    expect(acceptTypedChar('', 'a')).toBe('a');
  });

  test('keeps valid prefixes, deletions and pastes', () => {
    expect(acceptTypedChar('fr', 'fro')).toBe('fro');
    expect(acceptTypedChar('frm', 'fr')).toBe('fr');
    expect(acceptTypedChar('', 'abandon ability zzz')).toBe('abandon ability zzz');
  });

  test('only accepts a space right after a complete word', () => {
    expect(acceptTypedChar('frog', 'frog ')).toBe('frog ');
    expect(acceptTypedChar('add', 'add ')).toBe('add ');
    expect(acceptTypedChar('fro', 'fro ')).toBe('fro');
    expect(acceptTypedChar('', ' ')).toBe('');
    expect(acceptTypedChar('frog ', 'frog  ')).toBe('frog ');
    expect(acceptTypedChar('fro', 'fro\n')).toBe('fro');
  });

  test('leaves transfer codes and private keys alone', () => {
    expect(acceptTypedChar('0', '0x')).toBe('0x');
    expect(acceptTypedChar('stage-account:', 'stage-account:1')).toBe('stage-account:1');
    expect(acceptTypedChar('0xabc', '0xabc ')).toBe('0xabc ');
  });
});
