import { describe, expect, test } from 'bun:test';
import { attachmentKindOf } from '@stage-labs/client/xmtp/humanize';
import { makeLocalAttachmentCache } from '../lib/localAttachmentCache.core';
import { attachmentPreview, resolvedAttachmentKind } from '../components/bubble/fileCard.model';
import { planSendSteps, unsentDraft } from '../components/composer/send.model';
import { voiceFileMeta } from '../components/composer/voice.model';
import type { Attachment } from '../components/composer/types';

const REMOTE = { url: 'https://store.example/voice', contentDigest: 'voice-digest' };

function voice(mime: string): Attachment {
  const meta = voiceFileMeta(mime);
  return {
    id: 'voice', url: 'blob:voice', kind: 'audio', mime: meta.mime,
    name: `voice-123.${meta.extension}`, size: 1024,
  };
}

describe('outgoing audio previews', () => {
  test.each(['audio/webm;codecs=opus', 'audio/mp4', 'audio/m4a', 'audio/ogg', 'audio/wav'])(
    '%s keeps its MIME through upload, early echo and send confirmation', async mime => {
      const audio = voice(mime);
      const upload = Promise.withResolvers<undefined>();
      const sent = Promise.withResolvers<string>();
      const cache = makeLocalAttachmentCache();
      const steps = planSendSteps('line', '', [audio], undefined, {
        text: async () => 'text', reply: async () => 'reply',
        attachments: async (_line, files, notify) => {
          expect(files[0]?.mimeType).toBe(mime);
          await upload.promise;
          notify?.([REMOTE]);
          return sent.promise;
        },
      }, () => 'tmp_voice');
      const step = steps[0];
      if (!step) throw new Error('Missing voice step');
      expect(step.attachments).toEqual([audio]);
      expect(resolvedAttachmentKind(audio)).toBe('audio');
      const previews = step.attachments.map(at => ({ uri: at.url, mime: at.mime }));
      const result = step.run(uploaded => { cache.remember(step.localId, previews, uploaded); });
      expect(cache.get('echo', 0, REMOTE)).toBeUndefined();
      expect(resolvedAttachmentKind(step.attachments[0] ?? audio)).toBe('audio');
      upload.resolve();
      await upload.promise;
      const early = cache.get('echo', 0, REMOTE);
      expect(early).toEqual({ uri: 'blob:voice', mime });
      const guessedKind = attachmentKindOf({ filename: audio.name });
      if (mime.startsWith('audio/webm')) expect(guessedKind).toBe('video');
      const preview = attachmentPreview({}, early, { uri: null });
      expect(preview).toEqual(early);
      expect(resolvedAttachmentKind({ kind: guessedKind, mime: preview.mime })).toBe('audio');
      sent.resolve('echo');
      cache.remember(await result, previews);
      expect(cache.get('echo', 0)).toEqual(early);
      expect(cache.get('echo', 0, REMOTE)).toEqual(early);
    },
  );

  test('confirmation before the echo retains the MIME by both message and upload identity', () => {
    const cache = makeLocalAttachmentCache();
    const preview = { uri: 'blob:voice', mime: 'audio/webm' };
    cache.remember('tmp_voice', [preview], [REMOTE]);
    cache.remember('sent', [preview]);
    expect(cache.get('sent', 0)).toEqual(preview);
    expect(cache.get('early-echo', 0, REMOTE)).toEqual(preview);
  });

  test('failed upload restores audio metadata for retry without a video filename guess', async () => {
    const audio = voice('audio/webm');
    const steps = planSendSteps('line', '', [audio], undefined, {
      text: async () => 'text', reply: async () => 'reply',
      attachments: async () => { throw new Error('Upload failed'); },
    }, () => 'tmp_voice');
    const step = steps[0];
    if (!step) throw new Error('Missing voice step');
    await expect(step.run()).rejects.toThrow('Upload failed');
    const restored = unsentDraft('', [audio], steps);
    expect(restored.pending).toEqual([audio]);
    expect(restored.pending.map(resolvedAttachmentKind)).toEqual(['audio']);
  });

  test('decrypted metadata remains authoritative and uncached incoming previews are unchanged', () => {
    const local = { uri: 'blob:local', mime: 'audio/webm' };
    const remote = { uri: 'blob:remote', mime: 'audio/webm;codecs=opus' };
    expect(attachmentPreview({}, local, remote)).toEqual({ uri: local.uri, mime: remote.mime });
    expect(attachmentPreview({}, undefined, remote)).toEqual(remote);
    expect(attachmentPreview({ mime: 'audio/m4a' }, undefined, { uri: null })).toEqual({ uri: null, mime: 'audio/m4a' });
    expect(attachmentPreview({}, undefined, { uri: null })).toEqual({ uri: null, mime: undefined });
  });

  test('mixed uploads preserve their own MIME and indexes without relabeling real videos', () => {
    const cache = makeLocalAttachmentCache();
    const videoRemote = { ...REMOTE, contentDigest: 'video-digest' };
    const previews = [
      { uri: 'blob:voice', mime: 'audio/webm' },
      { uri: 'blob:video', mime: 'video/webm' },
    ];
    cache.remember('tmp_batch', previews, [REMOTE, videoRemote]);
    const audio = cache.get('echo', 0, REMOTE);
    const video = cache.get('echo', 1, videoRemote);
    expect(audio).toEqual(previews[0]);
    expect(video).toEqual(previews[1]);
    expect(resolvedAttachmentKind({ kind: 'video', mime: audio?.mime })).toBe('audio');
    expect(resolvedAttachmentKind({ kind: 'video', mime: video?.mime })).toBe('video');
    expect(cache.get('incoming', 0, { ...REMOTE, contentDigest: 'unrelated' })).toBeUndefined();
  });
});
