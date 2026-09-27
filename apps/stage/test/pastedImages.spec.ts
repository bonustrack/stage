import { describe, expect, test } from 'bun:test';
import {
  carriesPlainText, imageItemIndexes, pastedImageName, takesImagePaste, takesPicturePaste,
} from '../components/composer/pastedImages.model';

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

describe('pasting an image as a profile or group picture', () => {
  test('takes an image outside any field, and in a field unless the clipboard also carries text', () => {
    expect(takesPicturePaste(false, false)).toBe(true);
    expect(takesPicturePaste(false, true)).toBe(true);
    expect(takesPicturePaste(true, false)).toBe(true);
    expect(takesPicturePaste(true, true)).toBe(false);
  });

  test('sees plain text only in string items', () => {
    expect(carriesPlainText([{ kind: 'file', type: 'image/png' }])).toBe(false);
    expect(carriesPlainText([{ kind: 'string', type: 'text/html' }, { kind: 'file', type: 'image/png' }])).toBe(false);
    expect(carriesPlainText([{ kind: 'file', type: 'text/plain' }])).toBe(false);
    expect(carriesPlainText([{ kind: 'file', type: 'image/png' }, { kind: 'string', type: 'text/plain' }])).toBe(true);
  });
});
