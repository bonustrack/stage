import { describe, expect, test } from 'bun:test';
import { plainCopyText } from '../lib/plainCopy.model';

describe('copying selected text as plain text', () => {
  test('keeps the line breaks between messages', () => {
    expect(plainCopyText(false, 'first message\nsecond message')).toBe('first message\nsecond message');
  });

  test('keeps the text inside a message as typed', () => {
    expect(plainCopyText(false, 'line one  \n\nline three')).toBe('line one  \n\nline three');
  });

  test('drops the line breaks at the edges of a selection', () => {
    expect(plainCopyText(false, '\n\nhello\n')).toBe('hello');
  });

  test('leaves inputs and the composer to the browser', () => {
    expect(plainCopyText(true, 'typed text')).toBeNull();
  });

  test('leaves a selection without text to the browser', () => {
    expect(plainCopyText(false, '')).toBeNull();
    expect(plainCopyText(false, '\n')).toBeNull();
  });
});
