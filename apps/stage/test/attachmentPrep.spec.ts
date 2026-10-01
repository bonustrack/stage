import { describe, expect, mock, test } from 'bun:test';
import { makeAttachmentPrep } from '../lib/xmtp.attachmentPrep.core';

const photo = { fileUri: 'blob:photo', mimeType: 'image/png', filename: 'photo.png' };
const clip = { fileUri: 'blob:clip', mimeType: 'video/mp4', filename: 'clip.mp4' };

function makePrep(failFirstEncrypt = false) {
  let encrypts = 0;
  const encrypt = mock(async (file: typeof photo) => {
    encrypts += 1;
    if (failFirstEncrypt && encrypts === 1) throw new Error('encrypt failed');
    return `enc:${file.filename}`;
  });
  const store = mock(async (encrypted: string) => `url:${encrypted}`);
  return { encrypt, store, prep: makeAttachmentPrep(encrypt, store) };
}

describe('attachment prep', () => {
  test('a file prepared on pick is encrypted and uploaded once when sent', async () => {
    const { encrypt, store, prep } = makePrep();
    prep.prepare([photo]);
    prep.upload([photo]);
    expect(await prep.uploaded([photo])).toEqual(['url:enc:photo.png']);
    expect(encrypt).toHaveBeenCalledTimes(1);
    expect(store).toHaveBeenCalledTimes(1);
  });

  test('several files upload together and keep their order', async () => {
    const { prep } = makePrep();
    expect(await prep.uploaded([clip, photo])).toEqual(['url:enc:clip.mp4', 'url:enc:photo.png']);
  });

  test('a failed step runs again on the next try', async () => {
    const { encrypt, prep } = makePrep(true);
    prep.prepare([photo]);
    await expect(prep.uploaded([photo])).rejects.toThrow('encrypt failed');
    expect(await prep.uploaded([photo])).toEqual(['url:enc:photo.png']);
    expect(encrypt).toHaveBeenCalledTimes(2);
  });

  test('a forgotten file is prepared again from scratch', async () => {
    const { encrypt, store, prep } = makePrep();
    await prep.uploaded([photo]);
    prep.forget([photo]);
    await prep.uploaded([photo]);
    expect(encrypt).toHaveBeenCalledTimes(2);
    expect(store).toHaveBeenCalledTimes(2);
  });

  test('an upload failure encrypts the file again on the next try', async () => {
    let uploads = 0;
    const encrypt = mock(async (file: typeof photo) => `enc:${file.filename}`);
    const prep = makeAttachmentPrep(encrypt, async (encrypted: string) => {
      uploads += 1;
      if (uploads === 1) throw new Error('upload failed');
      return `url:${encrypted}`;
    });
    await expect(prep.uploaded([photo])).rejects.toThrow('upload failed');
    expect(await prep.uploaded([photo])).toEqual(['url:enc:photo.png']);
    expect(encrypt).toHaveBeenCalledTimes(2);
  });

  test('at most two files are encrypted at the same time', async () => {
    let running = 0;
    let peak = 0;
    const prep = makeAttachmentPrep(async (file: typeof photo) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise(done => { setTimeout(done, 5); });
      running -= 1;
      return file.filename;
    }, async (encrypted: string) => encrypted);
    const files = ['a', 'b', 'c', 'd'].map(n => ({ ...photo, fileUri: `blob:${n}`, filename: `${n}.png` }));
    expect(await prep.uploaded(files)).toEqual(['a.png', 'b.png', 'c.png', 'd.png']);
    expect(peak).toBe(2);
  });
});
