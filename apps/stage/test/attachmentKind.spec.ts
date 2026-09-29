import { describe, expect, test } from 'bun:test';
import { resolvedAttachmentKind } from '../components/bubble/attachmentKind.model';

describe('resolved attachment kind', () => {
  test.each(['audio/webm', 'audio/mp4'])('uses decrypted %s instead of a video filename guess', mime => {
    expect(resolvedAttachmentKind({ kind: 'video', mime })).toBe('audio');
  });

  test('uses decrypted video and image MIME types', () => {
    expect(resolvedAttachmentKind({ kind: 'audio', mime: 'video/mp4' })).toBe('video');
    expect(resolvedAttachmentKind({ kind: 'file', mime: 'image/webp' })).toBe('image');
  });

  test('keeps the filename guess when MIME metadata is unavailable', () => {
    expect(resolvedAttachmentKind({ kind: 'audio' })).toBe('audio');
    expect(resolvedAttachmentKind({ kind: 'file', mime: 'application/octet-stream' })).toBe('file');
  });
});
