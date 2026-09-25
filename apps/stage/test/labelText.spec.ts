import { describe, expect, test } from 'bun:test';
import { labelParts } from '../components/LabelText.model';

describe('labelParts', () => {
  test('keeps a plain label as one untouched text part', () => {
    expect(labelParts('In review')).toEqual([{ text: 'In review', emoji: false }]);
  });

  test('keeps surrounding spaces of a plain label', () => {
    expect(labelParts(' Draft ')).toEqual([{ text: ' Draft ', emoji: false }]);
  });

  test('splits a leading emoji from the text', () => {
    expect(labelParts('🚧 In progress')).toEqual([
      { text: '🚧', emoji: true },
      { text: 'In progress', emoji: false },
    ]);
  });

  test('splits emoji from the dingbat and misc symbol blocks', () => {
    expect(labelParts('✅ Done')).toEqual([{ text: '✅', emoji: true }, { text: 'Done', emoji: false }]);
    expect(labelParts('⭐ Star')).toEqual([{ text: '⭐', emoji: true }, { text: 'Star', emoji: false }]);
    expect(labelParts('⌛ Waiting')).toEqual([{ text: '⌛', emoji: true }, { text: 'Waiting', emoji: false }]);
  });

  test('splits a trailing emoji and one in the middle', () => {
    expect(labelParts('Ship 🚀')).toEqual([{ text: 'Ship', emoji: false }, { text: '🚀', emoji: true }]);
    expect(labelParts('Hot 🔥 fix')).toEqual([
      { text: 'Hot', emoji: false },
      { text: '🔥', emoji: true },
      { text: 'fix', emoji: false },
    ]);
  });

  test('keeps joined emoji sequences whole', () => {
    expect(labelParts('👩‍💻 Dev')).toEqual([{ text: '👩‍💻', emoji: true }, { text: 'Dev', emoji: false }]);
    expect(labelParts('❤️ Love')).toEqual([{ text: '❤️', emoji: true }, { text: 'Love', emoji: false }]);
    expect(labelParts('👍🏽 Ok')).toEqual([{ text: '👍🏽', emoji: true }, { text: 'Ok', emoji: false }]);
    expect(labelParts('🇫🇷 France')).toEqual([{ text: '🇫🇷', emoji: true }, { text: 'France', emoji: false }]);
    const england = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}';
    expect(labelParts(`${england} England`)).toEqual([{ text: england, emoji: true }, { text: 'England', emoji: false }]);
  });

  test('groups adjacent emoji into one part', () => {
    expect(labelParts('🔥🔥 Urgent')).toEqual([{ text: '🔥🔥', emoji: true }, { text: 'Urgent', emoji: false }]);
  });

  test('drops the blank between two spaced emoji', () => {
    expect(labelParts('🔥 🔥 Urgent')).toEqual([
      { text: '🔥', emoji: true },
      { text: '🔥', emoji: true },
      { text: 'Urgent', emoji: false },
    ]);
  });

  test('keeps an emoji only label as one part', () => {
    expect(labelParts('🔥')).toEqual([{ text: '🔥', emoji: false }]);
  });

  test('leaves accented letters and text symbols in the text', () => {
    expect(labelParts('Été №1 ©')).toEqual([{ text: 'Été №1 ©', emoji: false }]);
  });

  test('keeps a keycap with its digit', () => {
    expect(labelParts('1️⃣ First')).toEqual([{ text: '1️⃣ First', emoji: false }]);
  });
});
