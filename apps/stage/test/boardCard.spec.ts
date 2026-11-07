import { describe, expect, test } from 'bun:test';
import { boardCardShowsPreview } from '../components/home/board/BoardCard.model';

describe('Board card message preview', () => {
  test('omits empty-message previews on confirmed cards', () => {
    for (const preview of [undefined, null, '']) {
      expect(boardCardShowsPreview(true, preview, '')).toBe(false);
      expect(boardCardShowsPreview(true, preview, '   ')).toBe(false);
    }
  });

  test('keeps real message and draft previews, including messages resembling the old placeholder', () => {
    expect(boardCardShowsPreview(true, 'A real message', '')).toBe(true);
    expect(boardCardShowsPreview(true, '(no messages yet)', '')).toBe(true);
    expect(boardCardShowsPreview(true, '', '  Unsent draft  ')).toBe(true);
    expect(boardCardShowsPreview(true, 'A real message', 'Unsent draft')).toBe(true);
  });

  test('keeps the last-message field preference authoritative', () => {
    expect(boardCardShowsPreview(false, 'A real message', '')).toBe(false);
    expect(boardCardShowsPreview(false, '', 'Unsent draft')).toBe(false);
  });
});
