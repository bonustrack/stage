import { describe, expect, test } from 'bun:test';
import { mentionAddresses, mentionLabel, withMentionLabels } from '../components/bubble/mention.model';

const A = '0x59445094f08d01213bd6ba7215a6ab7a4bc29a4a';
const B = '0x6f53196a053da13a1cced1115d104ae5e4c4bc06';

describe('mention labels', () => {
  test('prefixes a name with a single @', () => {
    expect(mentionLabel('Chen')).toBe('@Chen');
    expect(mentionLabel('@chen123')).toBe('@chen123');
  });

  test('lists the mentioned addresses in order', () => {
    expect(mentionAddresses(`added @${A} and @${B.toUpperCase().replace('0X', '0x')}`)).toEqual([A, B]);
    expect(mentionAddresses('added 2 members')).toEqual([]);
  });

  test('replaces every mention with its label and keeps the text around it', () => {
    const names: Record<string, string> = { [A]: '@chen', [B]: '@tony' };
    expect(withMentionLabels(`added @${A} and @${B}`, a => names[a] ?? a)).toBe('added @chen and @tony');
    expect(withMentionLabels('hello', a => a)).toBe('hello');
  });
});
