import { describe, expect, test } from 'bun:test';
import { imageItemIndexes, pastedImageName, takesImagePaste } from '../components/composer/pastedImages.model';

describe('pasting images into the composer', () => {
  test('takes a paste in the message box or outside any field, never in another input', () => {
    expect(takesImagePaste('TEXTAREA', true)).toBe(true);
    expect(takesImagePaste('DIV', false)).toBe(true);
    expect(takesImagePaste(null, false)).toBe(true);
    expect(takesImagePaste('INPUT', true)).toBe(false);
  });

  test('keeps only image files from the clipboard', () => {
    expect(imageItemIndexes([
      { kind: 'string', type: 'text/plain' },
      { kind: 'file', type: 'image/png' },
      { kind: 'file', type: 'application/pdf' },
      { kind: 'file', type: 'image/jpeg' },
    ])).toEqual([1, 3]);
  });

  test('names unnamed pasted images by their type', () => {
    expect(pastedImageName('image/png', 0)).toBe('pasted-image-1.png');
    expect(pastedImageName('image/svg+xml', 1)).toBe('pasted-image-2.svg');
  });
});
