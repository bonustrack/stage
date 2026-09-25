import { describe, expect, test } from 'bun:test';
import { attachmentMimeType, mimeOf, outgoingFileMeta } from '../lib/attachmentFiles';

describe('attachment types', () => {
  test('an avif file with no type is an image', () => {
    expect(mimeOf('', 'photo.avif')).toBe('image/avif');
    expect(attachmentMimeType(undefined, 'photo.AVIF')).toBe('image/avif');
  });
});

describe('outgoingFileMeta', () => {
  test('a camera photo with no name gets an extension from its type', () => {
    expect(outgoingFileMeta({ id: 'local_1_ab', url: 'file:///c/x.jpg', mime: 'image/jpeg' }))
      .toEqual({ mimeType: 'image/jpeg', filename: 'local_1_ab.jpg' });
    expect(outgoingFileMeta({ id: 'local_2_cd', url: 'file:///c/y.mp4' }))
      .toEqual({ mimeType: 'video/mp4', filename: 'local_2_cd.mp4' });
  });

  test('keeps a name that already has an extension, or a type with none to add', () => {
    expect(outgoingFileMeta({ id: 'i', url: 'u', mime: 'image/png', name: 'shot.PNG' }).filename).toBe('shot.PNG');
    expect(outgoingFileMeta({ id: 'i', url: 'u', mime: 'image/png', name: 'shot' }).filename).toBe('shot.png');
    expect(outgoingFileMeta({ id: 'i', url: 'u', mime: 'text/plain', name: 'README' }).filename).toBe('README');
  });
});
