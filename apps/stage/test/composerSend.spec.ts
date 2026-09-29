import { describe, expect, mock, test } from 'bun:test';
import { planSendSteps } from '../components/composer/send.model';
import type { Attachment } from '../components/composer/types';

function makeSenders() {
  return {
    text: mock(async () => 'text-id'),
    reply: mock(async () => 'reply-id'),
    attachments: mock(async () => 'attachment-id'),
  };
}

function attachment(kind: string, size = 11_000_000): Attachment {
  const mime = kind === 'audio' ? 'audio/m4a' : 'video/mp4';
  const name = kind === 'audio' ? 'voice.m4a' : 'clip.mp4';
  return { id: kind, url: `file:///${name}`, kind, mime, name, size };
}

describe('composer sends encrypted remote attachments', () => {
  test('large audio uses remote storage rather than an inline message limit', async () => {
    const senders = makeSenders();
    const audio = attachment('audio');
    const steps = planSendSteps('line', '', [audio], undefined, senders, () => 'local-id');
    expect(steps).toHaveLength(1);
    expect(steps[0]?.attachments).toEqual([audio]);
    expect(await steps[0]?.run()).toBe('attachment-id');
    expect(senders.attachments).toHaveBeenCalledWith('line', [{
      fileUri: audio.url, mimeType: 'audio/m4a', filename: 'voice.m4a',
    }]);
  });

  test('mixed audio and video keep their order and metadata in one attachment step', async () => {
    const senders = makeSenders();
    const files = [attachment('audio'), attachment('video')];
    const steps = planSendSteps('line', '', files, undefined, senders, () => 'local-id');
    expect(steps).toHaveLength(1);
    expect(steps[0]?.attachments).toEqual(files);
    await steps[0]?.run();
    expect(senders.attachments).toHaveBeenCalledWith('line', [
      { fileUri: 'file:///voice.m4a', mimeType: 'audio/m4a', filename: 'voice.m4a' },
      { fileUri: 'file:///clip.mp4', mimeType: 'video/mp4', filename: 'clip.mp4' },
    ]);
  });

  test('text precedes attachments with distinct optimistic ids', async () => {
    const senders = makeSenders();
    let id = 0;
    const steps = planSendSteps('line', 'caption', [attachment('video')], undefined, senders, () => `local-${id++}`);
    expect(steps.map(step => step.localId)).toEqual(['local-0', 'local-1']);
    expect(steps[0]?.text).toBe('caption');
    expect(steps[0]?.attachments).toEqual([]);
    expect(await steps[0]?.run()).toBe('text-id');
    expect(senders.text).toHaveBeenCalledWith('line', 'caption');
    expect(await steps[1]?.run()).toBe('attachment-id');
  });

  test('reply text keeps its original recipient and reference', async () => {
    const senders = makeSenders();
    const steps = planSendSteps('line', 'reply', [], 'reference', senders, () => 'local-id');
    expect(await steps[0]?.run()).toBe('reply-id');
    expect(senders.reply).toHaveBeenCalledWith('line', 'reference', 'reply');
    expect(senders.text).not.toHaveBeenCalled();
    expect(senders.attachments).not.toHaveBeenCalled();
  });

  test('empty drafts do not allocate ids or send anything', () => {
    const senders = makeSenders();
    const mint = mock(() => 'local-id');
    expect(planSendSteps('line', '', [], undefined, senders, mint)).toEqual([]);
    expect(mint).not.toHaveBeenCalled();
  });

  test('an upload failure rejects the attachment step', async () => {
    const senders = makeSenders();
    senders.attachments.mockImplementation(async () => { throw new Error('upload failed (413)'); });
    const steps = planSendSteps('line', '', [attachment('video')], undefined, senders, () => 'local-id');
    const step = steps[0];
    if (!step) throw new Error('Missing attachment step');
    await expect(step.run()).rejects.toThrow('upload failed (413)');
  });
});
