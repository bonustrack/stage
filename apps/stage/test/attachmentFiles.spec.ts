import { describe, expect, test } from 'bun:test';
import { attachmentMimeType, mimeOf } from '../lib/attachmentFiles';

describe('attachment types', () => {
  test('an avif file with no type is an image', () => {
    expect(mimeOf('', 'photo.avif')).toBe('image/avif');
    expect(attachmentMimeType(undefined, 'photo.AVIF')).toBe('image/avif');
  });
});
