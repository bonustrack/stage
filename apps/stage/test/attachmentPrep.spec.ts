import { describe, expect, mock, test } from 'bun:test';
import { makeAttachmentPrep } from '../lib/xmtp.attachmentPrep.core';
import { sendPreparedAttachment, sendPreparedMessage, type SendTarget } from '../lib/xmtp.messageSend.core';

const targetOf = <C>(conv: C): SendTarget<C> => ({ conv, assertCurrent: () => undefined });

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

describe('attachment send account capture', () => {
  test('rejects switches during upload, upload callbacks and conversation preparation', async () => {
    for (const phase of ['upload', 'callback', 'find']) {
      let current = true;
      let sent = false;
      await expect(
        sendPreparedAttachment({
          assertCurrent: () => {
            if (!current) throw new Error('account changed');
          },
          uploaded: async () => {
            if (phase === 'upload') current = false;
            return ['encrypted attachment'];
          },
          onUploaded: () => {
            if (phase === 'callback') current = false;
          },
          find: async () => {
            if (phase === 'find') current = false;
            return targetOf('shared group');
          },
          send: async () => {
            sent = true;
            return 'id';
          },
        }),
      ).rejects.toThrow('account changed');
      expect(sent).toBe(false);
    }
  });

  test('destination checks run after upload and conversation preparation, before transport', async () => {
    for (const phase of ['upload', 'find']) {
      let accepted = true;
      const send = mock(async () => 'id');
      await expect(
        sendPreparedAttachment({
          assertCurrent: () => undefined,
          uploaded: async () => {
            if (phase === 'upload') accepted = false;
            return ['encrypted'];
          },
          find: async () => {
            if (phase === 'find') accepted = false;
            return targetOf('conversation');
          },
          beforeSend: async () => {
            if (!accepted) throw new Error('destination changed');
          },
          send,
        }),
      ).rejects.toThrow('destination changed');
      expect(send).not.toHaveBeenCalled();
    }
  });

  test('rechecks the account after an asynchronous destination check', async () => {
    let current = true;
    const send = mock(async () => 'id');
    await expect(
      sendPreparedAttachment({
        assertCurrent: () => {
          if (!current) throw new Error('account changed');
        },
        uploaded: async () => ['encrypted'],
        find: async () => targetOf('conversation'),
        beforeSend: async () => {
          current = false;
        },
        send,
      }),
    ).rejects.toThrow('account changed');
    expect(send).not.toHaveBeenCalled();
  });

  test('uploads first, then performs just-in-time sender preparation under the initiating session', async () => {
    const order: string[] = [];
    expect(
      await sendPreparedAttachment({
        assertCurrent: () => {
          order.push('check');
        },
        uploaded: async () => {
          order.push('upload');
          return ['encrypted attachment'];
        },
        find: async () => {
          order.push('prepare');
          return targetOf('conversation');
        },
        send: async (_conv, infos) => {
          order.push('send');
          expect(infos).toEqual(['encrypted attachment']);
          return 'id';
        },
      }),
    ).toBe('id');
    expect(order).toEqual(['check', 'upload', 'check', 'check', 'prepare', 'check', 'send']);
  });
});

describe('message send', () => {
  test('rechecks the conversation target after the before-send hook, before transport', async () => {
    let current = true;
    const send = mock(async () => 'id');
    const target: SendTarget<string> = {
      conv: 'conversation',
      assertCurrent: () => {
        if (!current) throw new Error('account changed');
      },
    };
    const beforeSend = async (): Promise<void> => {
      current = false;
    };
    await expect(sendPreparedMessage({ find: async () => target, beforeSend, send })).rejects.toThrow('account changed');
    expect(send).not.toHaveBeenCalled();
    current = true;
    expect(await sendPreparedMessage({ find: async () => target, send })).toBe('id');
    expect(send).toHaveBeenCalledWith('conversation');
  });
});

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
    const prep = makeAttachmentPrep(
      async (file: typeof photo) => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((done) => {
          setTimeout(done, 5);
        });
        running -= 1;
        return file.filename;
      },
      async (encrypted: string) => encrypted,
    );
    const files = ['a', 'b', 'c', 'd'].map((n) => ({ ...photo, fileUri: `blob:${n}`, filename: `${n}.png` }));
    expect(await prep.uploaded(files)).toEqual(['a.png', 'b.png', 'c.png', 'd.png']);
    expect(peak).toBe(2);
  });
});
