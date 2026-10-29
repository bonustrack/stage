import { describe, expect, mock, test } from 'bun:test';
import { base64ToBytes } from '@stage-labs/client/text/base64';
import { planSendSteps, unsentDraft } from '../components/composer/send.model';
import { COMPOSER_TEXT_BYTE_LIMIT, textAttachment } from '../components/composer/textAttachment.model';
import { locationAttachment } from '../components/composer/location.model';
import type { Attachment } from '../components/composer/types';
import type { LocalAttachmentInput, OnAttachmentsUploaded } from '../lib/xmtp.types';

const longText = `  Café, ไทย, 👨‍👩‍👧‍👦, é\r\n${'Full original text\n\n'.repeat(300)}\t \n`;
const photo: Attachment = { id: 'photo', url: 'file:///photo.jpg', kind: 'image', mime: 'image/jpeg', name: 'photo.jpg', size: 10 };

function senders() {
  return {
    text: mock(async () => 'text-id'),
    reply: mock(async () => 'reply-id'),
    attachments: mock<
      (
        line: string,
        files: LocalAttachmentInput[],
        onUploaded?: OnAttachmentsUploaded,
        beforeSend?: () => Promise<void>,
        replyTo?: string,
      ) => Promise<string>
    >(async () => 'file-id'),
  };
}

function planner(body: string, pending: Attachment[] = [], replyTo?: string) {
  const ports = senders();
  let seq = 0;
  return { ports, steps: planSendSteps('line', body, pending, replyTo, ports, () => `local-${seq++}`) };
}

function bytesOf(file: Attachment): Uint8Array {
  return base64ToBytes(file.url.slice('data:text/plain;base64,'.length));
}

describe('large composer text becomes a UTF-8 attachment', () => {
  test('the exact byte limit remains a normal message, the next byte becomes a file', () => {
    const mint = mock(() => 'text-file');
    expect(COMPOSER_TEXT_BYTE_LIMIT).toBe(4096);
    expect(textAttachment('a'.repeat(4095), mint)).toBeNull();
    expect(textAttachment('a'.repeat(4096), mint)).toBeNull();
    expect(mint).not.toHaveBeenCalled();
    expect(textAttachment('a'.repeat(4097), mint)).toMatchObject({
      id: 'text-file',
      size: 4097,
      name: 'message.txt',
      mime: 'text/plain',
      kind: 'file',
    });
  });

  test('the limit counts UTF-8 bytes, not UTF-16 units or glyphs', () => {
    expect(textAttachment('😀'.repeat(1024), () => 'id')).toBeNull();
    expect(textAttachment(`${'😀'.repeat(1024)}a`, () => 'id')?.size).toBe(4097);
    expect(textAttachment('界'.repeat(1366), () => 'id')?.size).toBe(4098);
  });

  test('all original bytes survive, including a BOM, combining marks, CRLF, blank lines and outer whitespace', () => {
    const original = `﻿${longText}`;
    const file = textAttachment(original, () => 'id');
    if (file === null) throw new Error('Missing text attachment');
    expect(bytesOf(file)).toEqual(new TextEncoder().encode(original));
    expect(file.size).toBe(bytesOf(file).length);
  });

  test('a large draft creates one file step and sends no duplicate text or caption', async () => {
    const { ports, steps } = planner(longText);
    expect(steps).toHaveLength(1);
    expect(steps[0]?.text).toBe('');
    expect(steps[0]?.sourceText).toBe(true);
    expect(steps[0]?.attachments).toHaveLength(1);
    await steps[0]?.run();
    expect(ports.text).not.toHaveBeenCalled();
    expect(ports.reply).not.toHaveBeenCalled();
    expect(ports.attachments).toHaveBeenCalledTimes(1);
  });

  test('short text keeps its existing trimming, caption and reply behavior', async () => {
    const { ports, steps } = planner('  caption\n', [photo], 'original');
    expect(steps.map((s) => s.text)).toEqual(['caption', '']);
    for (const step of steps) await step.run();
    expect(ports.reply).toHaveBeenCalledWith('line', 'original', 'caption');
    expect(ports.attachments).toHaveBeenCalledWith('line', [{ fileUri: photo.url, mimeType: photo.mime, filename: photo.name }], undefined);
  });

  test('the generated file replaces the caption step without reordering picked files or a location', async () => {
    const location = locationAttachment(1, 2, 'location');
    const { ports, steps } = planner(longText, [photo, location]);
    expect(steps.map((s) => s.localId)).toEqual(['local-0', 'local-1', 'local-2']);
    expect(steps[0]?.attachments[0]?.name).toBe('message.txt');
    expect(steps[1]?.attachments).toEqual([photo]);
    expect(steps[2]?.location).toEqual(location);
    for (const step of steps) await step.run();
    expect(ports.attachments).toHaveBeenCalledTimes(2);
    expect(ports.text).toHaveBeenCalledTimes(1);
  });

  test('a long reply keeps its reference on the generated file only', async () => {
    const { ports, steps } = planner(longText, [photo], 'reference');
    const generated = steps[0]?.attachments[0];
    for (const step of steps) await step.run();
    expect(ports.attachments.mock.calls[0]).toEqual([
      'line',
      [{ fileUri: generated?.url, mimeType: 'text/plain', filename: 'message.txt' }],
      undefined,
      undefined,
      'reference',
    ]);
    expect(ports.attachments.mock.calls[1]).toEqual([
      'line',
      [{ fileUri: photo.url, mimeType: photo.mime, filename: photo.name }],
      undefined,
    ]);
    expect(ports.reply).not.toHaveBeenCalled();
  });

  test('reply attachment sends still assert the account after asynchronous send preparation', async () => {
    const ports = senders();
    const assertCurrent = mock(() => undefined);
    const beforeSend = mock(async () => undefined);
    const steps = planSendSteps('line', longText, [], 'reference', ports, () => 'id', assertCurrent, beforeSend);
    await steps[0]?.run();
    const validate = ports.attachments.mock.calls[0]?.[3] as (() => Promise<void>) | undefined;
    expect(assertCurrent).toHaveBeenCalledTimes(1);
    await validate?.();
    expect(beforeSend).toHaveBeenCalledTimes(1);
    expect(assertCurrent).toHaveBeenCalledTimes(2);
  });
});

describe('large text recovery after a send failure', () => {
  test('a failed generated file restores the exact original text, not an extra generated pending file', () => {
    const { steps } = planner(longText, [photo]);
    expect(unsentDraft(longText, [photo], steps)).toEqual({ text: longText, pending: [photo] });
  });

  test('when the text file went out, a later failure restores only the existing unsent attachments', () => {
    const { steps } = planner(longText, [photo]);
    expect(unsentDraft(longText, [photo], steps.slice(1))).toEqual({ text: '', pending: [photo] });
    expect(unsentDraft(longText, [photo], [])).toEqual({ text: '', pending: [] });
  });
});
