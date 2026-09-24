import { describe, expect, test } from 'bun:test';
import { english } from 'viem/accounts';
import {
  acceptTypedChar, applyCompletion, currentToken, normalizePastedPhrase, suggestWords, typePhrase, visibleSuggestions,
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

describe('suggestWords', () => {
  test('lists words for a prefix, capped', () => {
    expect(suggestWords('act')).toEqual(['act', 'action', 'actor', 'actress', 'actual']);
    expect(suggestWords('')).toEqual([]);
    expect(suggestWords('qqq')).toEqual([]);
    expect(applyCompletion('abandon act', 'actor')).toBe('abandon actor ');
  });
});

describe('acceptTypedChar', () => {
  test('rejects a character that cannot start any word', () => {
    expect(acceptTypedChar('fr', 'frm')).toBe('fr');
    expect(acceptTypedChar('', 'x')).toBe('');
    expect(acceptTypedChar('', 'a')).toBe('a');
  });

  test('never completes a word for the typist, so whole words type through unchanged', () => {
    let text = '';
    for (const ch of 'weekend palace') text = acceptTypedChar(text, text + ch);
    expect(text).toBe('weekend palace');
  });

  test('inserts the space when the next word starts right after a finished one', () => {
    expect(acceptTypedChar('weekend', 'weekendp')).toBe('weekend p');
    expect(acceptTypedChar('act', 'acti')).toBe('acti');
    expect(acceptTypedChar('act', 'actx')).toBe('act');
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

describe('typePhrase', () => {
  const typeAll = (input: string): string => {
    let state = { text: '', pending: '' };
    for (const ch of input) state = typePhrase(state, state.text + ch);
    return state.text;
  };

  test('fills a word as soon as only one word matches', () => {
    expect(typePhrase({ text: 'we', pending: '' }, 'wee')).toEqual({ text: 'weekend ', pending: 'kend' });
  });

  test('keeps suggesting while several words still match', () => {
    expect(typePhrase({ text: 'a', pending: '' }, 'ac')).toEqual({ text: 'ac', pending: '' });
  });

  test('typing the rest of a filled word, and the space after it, changes nothing', () => {
    expect(typeAll('weekend palace')).toBe('weekend palace ');
    expect(typeAll('weekend ')).toBe('weekend ');
  });

  test('typing another letter after a fill starts the next word', () => {
    expect(typePhrase({ text: 'weekend ', pending: 'kend' }, 'weekend p')).toEqual({ text: 'weekend p', pending: '' });
  });

  test('deleting or pasting never fills a word', () => {
    expect(typePhrase({ text: 'weekend ', pending: 'kend' }, 'weekend')).toEqual({ text: 'weekend', pending: '' });
    expect(typePhrase({ text: '', pending: '' }, 'wee')).toEqual({ text: 'wee', pending: '' });
  });
});

describe('visibleSuggestions', () => {
  test('never suggests the word that is already typed', () => {
    expect(visibleSuggestions('soda')).toEqual([]);
    expect(visibleSuggestions('act')).not.toContain('act');
    expect(visibleSuggestions('act').length).toBeGreaterThan(0);
  });
});

describe('pasting a phrase', () => {
  test('dashes and underscores become spaces, extra spaces collapse and the ends are trimmed', () => {
    expect(normalizePastedPhrase('  Abandon-ability_able   about \n')).toBe('abandon ability able about');
    expect(typePhrase({ text: '', pending: '' }, ' weekend_palace-soda ')).toEqual({ text: 'weekend palace soda', pending: '' });
  });

  test('a pasted private key or code is only trimmed', () => {
    expect(normalizePastedPhrase(' 0xabc123 ')).toBe('0xabc123');
    expect(normalizePastedPhrase('stage-transfer:v1:abc')).toBe('stage-transfer:v1:abc');
  });
});
