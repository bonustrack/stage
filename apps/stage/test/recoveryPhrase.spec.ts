import { describe, expect, test } from 'bun:test';
import { english } from 'viem/accounts';
import { replaceWordAt, typePhrase, visibleSuggestions, wordAt } from '../components/onboarding/RecoveryPhrase.model';

const typed = (previous: string, next: string): string => typePhrase({ text: previous, pending: '' }, next).text;

describe('BIP-39 wordlist shape', () => {
  test('filling a word after four letters relies on every word being unique in its first four letters, but not its first three', () => {
    const four = new Set(english.map((w) => w.slice(0, 4)));
    expect(four.size).toBe(english.length);
    const three = new Set(english.map((w) => w.slice(0, 3)));
    expect(three.size).toBeLessThan(english.length);
  });
});

describe('typing a phrase letter by letter', () => {
  test('rejects a character that cannot start any word', () => {
    expect(typed('fr', 'frm')).toBe('fr');
    expect(typed('', 'x')).toBe('');
    expect(typed('', 'a')).toBe('a');
  });

  test('inserts the space when the next word starts right after a finished one, not when the letter continues the word', () => {
    expect(typed('weekend', 'weekendp')).toBe('weekend p');
    expect(typePhrase({ text: 'act', pending: '' }, 'acti')).toEqual({ text: 'action ', pending: 'on' });
    expect(typed('act', 'actx')).toBe('act');
  });

  test('keeps valid prefixes, deletions and pastes', () => {
    expect(typed('fr', 'fro')).toBe('fro');
    expect(typed('frm', 'fr')).toBe('fr');
    expect(typed('', 'abandon ability zzz')).toBe('abandon ability zzz');
  });

  test('only accepts a space right after a complete word', () => {
    expect(typed('frog', 'frog ')).toBe('frog ');
    expect(typed('add', 'add ')).toBe('add ');
    expect(typed('fro', 'fro ')).toBe('fro');
    expect(typed('', ' ')).toBe('');
    expect(typed('frog ', 'frog  ')).toBe('frog ');
    expect(typed('fro', 'fro\n')).toBe('fro');
  });

  test('leaves transfer codes and private keys alone', () => {
    expect(typed('0', '0x')).toBe('0x');
    expect(typed('stage-account:', 'stage-account:1')).toBe('stage-account:1');
    expect(typed('0xabc', '0xabc ')).toBe('0xabc ');
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
  test('lists the other words that start with what is typed, and nothing for an empty or unknown prefix', () => {
    expect(visibleSuggestions('act')).toEqual(['action', 'actor', 'actress', 'actual']);
    expect(visibleSuggestions('a')).toHaveLength(6);
    expect(visibleSuggestions('')).toEqual([]);
    expect(visibleSuggestions('qqq')).toEqual([]);
  });

  test('never suggests the word that is already typed', () => {
    expect(visibleSuggestions('soda')).toEqual([]);
  });
});

describe('pasting a phrase', () => {
  test('dashes and underscores become spaces, extra spaces collapse and the ends are trimmed', () => {
    expect(typed('', '  Abandon-ability_able   about \n')).toBe('abandon ability able about');
    expect(typePhrase({ text: '', pending: '' }, ' weekend_palace-soda ')).toEqual({ text: 'weekend palace soda', pending: '' });
  });

  test('anything that is not a letter becomes a space, numbered lists included', () => {
    expect(typed('', '1. abandon 2. ability, able/about.soda')).toBe('abandon ability able about soda');
    expect(typed('', 'Abandon\tability\n\nable')).toBe('abandon ability able');
  });

  test('a pasted private key or code is only trimmed', () => {
    expect(typed('', ' 0xabc123 ')).toBe('0xabc123');
    expect(typed('', ` ${'a1'.repeat(32)} `)).toBe('a1'.repeat(32));
    expect(typed('', 'stage-transfer:v1:abc')).toBe('stage-transfer:v1:abc');
  });
});

describe('editing a word in the middle', () => {
  const text = 'weekend pal soda';

  test('the word under the cursor is the current word', () => {
    expect(wordAt(text, 10)).toEqual({ word: 'pal', start: 8, end: 11 });
    expect(wordAt(text, 11)).toEqual({ word: 'pal', start: 8, end: 11 });
    expect(wordAt(text, text.length)).toEqual({ word: 'soda', start: 12, end: 16 });
    expect(wordAt('weekend ', 8)).toEqual({ word: '', start: 8, end: 8 });
  });

  test('picking a suggestion replaces only that word and puts the cursor after it', () => {
    expect(replaceWordAt(text, wordAt(text, 11), 'palace')).toEqual({ text: 'weekend palace soda', cursor: 15 });
    expect(replaceWordAt('weekend pal', wordAt('weekend pal', 11), 'palace')).toEqual({ text: 'weekend palace ', cursor: 15 });
  });

  test('a letter typed in the middle is kept exactly, with no fill or cleanup', () => {
    expect(typePhrase({ text: 'weekend pal soda ', pending: '' }, 'weekend palm soda ')).toEqual({
      text: 'weekend palm soda ',
      pending: '',
    });
  });
});
