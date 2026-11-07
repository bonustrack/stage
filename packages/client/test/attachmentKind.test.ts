import { describe, expect, test } from 'bun:test';
import { attachmentEmojiPreview, attachmentKindOf, attachmentsPreview, entryAttachmentKind, isSvgAttachment } from '../src/xmtp/humanize';
import { rowPreviewOf } from '../src/xmtp/contentTypes';

describe('SVG attachments', () => {
  test('are recognised by type or by name', () => {
    expect(isSvgAttachment({ mimeType: 'image/svg+xml' })).toBe(true);
    expect(isSvgAttachment({ mimeType: 'IMAGE/SVG+XML; charset=utf-8' })).toBe(true);
    expect(isSvgAttachment({ filename: 'logo.SVG' })).toBe(true);
    expect(isSvgAttachment({ filename: 'logo.svgz' })).toBe(true);
    expect(isSvgAttachment({ mimeType: 'image/png', filename: 'photo.png' })).toBe(false);
  });

  test('show as files instead of pictures, since an SVG can carry code', () => {
    expect(entryAttachmentKind({ kind: 'image', mime: 'image/svg+xml', name: 'logo.svg' })).toBe('file');
    expect(entryAttachmentKind({ kind: 'image', name: 'logo.svg' })).toBe('file');
    expect(entryAttachmentKind({ kind: 'image', mime: 'image/png', name: 'photo.png' })).toBe('image');
    expect(entryAttachmentKind({ kind: 'file', mime: 'audio/mp4' })).toBe('audio');
  });

  test('are files in the chat list preview and in the stamped entry kind too', () => {
    expect(attachmentKindOf({ mimeType: 'image/svg+xml' })).toBe('file');
    expect(attachmentsPreview([{ mimeType: 'image/svg+xml', filename: 'logo.svg' }])).toBe('Sent a file');
    expect(attachmentEmojiPreview('image/svg+xml', 'logo.svg')).toBe('📎');
    const content = { filename: 'logo.svg', mimeType: 'image/svg+xml', data: '' };
    expect(rowPreviewOf({ content, contentTypeId: 'xmtp.org/attachment:1.0' })).toBe('Sent a file');
  });
});

describe('entry attachment kind', () => {
  test.each(['audio/webm', 'audio/mp4'])('uses decrypted %s instead of a video filename guess', (mime) => {
    expect(entryAttachmentKind({ kind: 'video', mime })).toBe('audio');
  });

  test('uses decrypted video and image MIME types', () => {
    expect(entryAttachmentKind({ kind: 'audio', mime: 'video/mp4' })).toBe('video');
    expect(entryAttachmentKind({ kind: 'file', mime: 'image/webp' })).toBe('image');
  });

  test('keeps the filename guess when MIME metadata is unavailable', () => {
    expect(entryAttachmentKind({ kind: 'audio' })).toBe('audio');
    expect(entryAttachmentKind({ kind: 'file', mime: 'application/octet-stream' })).toBe('file');
  });
});
