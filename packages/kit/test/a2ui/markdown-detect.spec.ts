import { describe, expect, test } from 'bun:test';
import { hasMarkdown } from '../../src/react-native/a2ui-context';

describe('hasMarkdown', () => {
  test('plain data that only looks like markdown stays plain', () => {
    for (const text of ['first_last@example.com', '261015_MCI_ADZ_Wochenprotokoll.xlsx', 'list_organizations', 'a > b', 'Price: 5 * 3 = 15', '#hashtag', 'array[0] | pipe', '~/home', 'C# and F#']) {
      expect(hasMarkdown(text)).toBe(false);
    }
  });

  test('real markdown is detected', () => {
    for (const text of ['Some **bold** text', 'an *em* word', '_italic_ text', 'use `code` here', '~~gone~~', '# Title', '> quote', '- item', '1. first', '| a | b |\n|---|---|\n| 1 | 2 |']) {
      expect(hasMarkdown(text)).toBe(true);
    }
  });
});
