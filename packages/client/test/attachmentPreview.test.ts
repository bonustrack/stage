import { describe, expect, test } from 'bun:test';
import { attachmentEmojiPreview, attachmentsPreview, previewOfXmtpContent } from '../src/xmtp/humanize';

const remote = (filename: string) => ({ url: 'https://example.com/blob', contentDigest: 'x', filename });

describe('previewOfXmtpContent for attachments', () => {
  test('names a single image for every attachment content type', () => {
    expect(previewOfXmtpContent({ filename: 'a.bin', mimeType: 'image/png', data: '' }, 'xmtp.org/attachment:1.0'))
      .toBe('Sent an image');
    expect(previewOfXmtpContent(remote('a.jpg'), 'xmtp.org/remoteStaticAttachment:1.0')).toBe('Sent an image');
    expect(previewOfXmtpContent({ attachments: [remote('a.png')] }, 'xmtp.org/multiRemoteStaticAttachment:1.0'))
      .toBe('Sent an image');
    expect(previewOfXmtpContent({ attachments: [remote('a.webp')] }, 'multiRemoteAttachment')).toBe('Sent an image');
  });

  test('counts several images in one message', () => {
    const three = { attachments: [remote('a.jpg'), remote('b.PNG'), remote('c.heic')] };
    expect(previewOfXmtpContent(three, 'xmtp.org/multiRemoteStaticAttachment:1.0')).toBe('Sent 3 images');
  });

  test('falls back to attachments when the kinds are mixed', () => {
    const mixed = { attachments: [remote('a.jpg'), remote('b.mp4')] };
    expect(previewOfXmtpContent(mixed, 'xmtp.org/multiRemoteStaticAttachment:1.0')).toBe('Sent 2 attachments');
  });

  test('never leaks the raw content type for an attachment', () => {
    for (const typeId of ['attachment', 'remoteStaticAttachment', 'multiRemoteStaticAttachment', 'multiRemoteAttachment']) {
      expect(previewOfXmtpContent({ attachments: [] }, `xmtp.org/${typeId}:1.0`)).not.toContain('[');
    }
  });
});

describe('attachmentsPreview', () => {
  test('words each kind in the singular and the plural', () => {
    expect(attachmentsPreview([{ filename: 'clip.mov' }])).toBe('Sent a video');
    expect(attachmentsPreview([{ mimeType: 'video/mp4' }, { filename: 'b.webm' }])).toBe('Sent 2 videos');
    expect(attachmentsPreview([{ filename: 'voice.m4a' }])).toBe('Sent a voice message');
    expect(attachmentsPreview([{ mimeType: 'audio/ogg' }, { mimeType: 'audio/aac' }])).toBe('Sent 2 voice messages');
    expect(attachmentsPreview([{ filename: 'notes.pdf' }])).toBe('Sent a file');
    expect(attachmentsPreview([{ filename: 'a.pdf' }, { filename: 'b.zip' }])).toBe('Sent 2 files');
  });

  test('keeps the emoji preview for a single attachment', () => {
    expect(attachmentEmojiPreview('image/jpeg', 'x')).toBe('📷');
    expect(attachmentEmojiPreview(undefined, 'a.mp3')).toBe('🎤');
    expect(attachmentEmojiPreview(undefined, 'a.mov')).toBe('🎥');
    expect(attachmentEmojiPreview(undefined, 'a.pdf')).toBe('📎');
  });
});
