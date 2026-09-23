import { describe, expect, test } from 'bun:test';
import { validateStageLabel } from '@stage-labs/client/identity/stageNames';
import { randomUsername, usernameFromWords } from '../lib/randomUsername';

describe('usernameFromWords', () => {
  test('joins the words in lowercase without separators', () => {
    expect(usernameFromWords({ adjective: 'Brave', noun: 'Otter', digits: '42' })).toBe('braveotter');
  });
  test('pads a short pair with digits until it is long enough', () => {
    expect(usernameFromWords({ adjective: 'big', noun: 'ox', digits: '42' })).toBe('bigox42');
    expect(usernameFromWords({ adjective: 'a', noun: 'b', digits: '42' })).toBe('ab4242');
  });
  test('strips characters the name service refuses', () => {
    expect(usernameFromWords({ adjective: "d'or", noun: 'café', digits: '7' })).toBe('dorcaf');
  });
  test('always yields a valid stage label', () => {
    for (const words of [{ adjective: 'x', noun: 'y', digits: '1' }, { adjective: 'extraordinarily', noun: 'unbelievableness', digits: '99' }]) {
      expect(validateStageLabel(usernameFromWords(words))).toBeNull();
    }
  });
});

describe('randomUsername', () => {
  test('always yields a valid stage label', () => {
    for (let i = 0; i < 200; i++) {
      expect(validateStageLabel(randomUsername())).toBeNull();
    }
  });
});
