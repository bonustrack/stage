import { describe, expect, test } from 'bun:test';
import { attachmentSource } from '../components/media/attachment';

const REMOTE = { url: 'https://store.example/a', contentDigest: 'd' };
const DATA = 'data:image/png;base64,AA';
const idle = { uri: null, isError: false };
const shown = (uri: string | null, mime?: string) => ({ uri, mime, failed: false });

describe('attachmentSource', () => {
  test('an inline file shows its data, or the local copy kept for a message still sending', () => {
    expect(attachmentSource({ mime: 'image/png' }, DATA, undefined, idle)).toEqual(shown(DATA, 'image/png'));
    expect(attachmentSource({ mime: 'image/png' }, 'file:///a.png', { uri: 'blob:a', mime: 'image/jpeg' }, idle)).toEqual(
      shown('blob:a', 'image/jpeg'),
    );
  });

  test('a remote file waits for its download unless a local copy is known, and the download names the type', () => {
    expect(attachmentSource({ remote: REMOTE }, '', undefined, idle)).toEqual(shown(null));
    expect(attachmentSource({ remote: REMOTE, mime: 'audio/m4a' }, '', { uri: 'blob:a', mime: 'audio/mp4' }, idle)).toEqual(
      shown('blob:a', 'audio/mp4'),
    );
    expect(attachmentSource({ remote: REMOTE }, '', undefined, { uri: 'file:///a', mime: 'image/webp', isError: false })).toEqual(
      shown('file:///a', 'image/webp'),
    );
  });

  test('a failed download is a failure only when no local copy can stand in', () => {
    expect(attachmentSource({ remote: REMOTE }, '', undefined, { uri: null, isError: true }).failed).toBe(true);
    expect(attachmentSource({ remote: REMOTE }, '', { uri: 'blob:a' }, { uri: null, isError: true }).failed).toBe(false);
  });
});
