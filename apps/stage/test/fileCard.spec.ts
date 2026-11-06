import { describe, expect, test } from 'bun:test';
import { fileCardModel, fileSizeLabel } from '../components/media/fileCard.model';
import { attachmentKind as resolvedAttachmentKind } from '../components/media/attachment';

describe('file card', () => {
  test('describes the file type and size', () => {
    expect(fileCardModel({ name: 'report.pdf', size: 1_572_864, kind: 'file' })).toEqual({ title: 'report.pdf', subtitle: 'PDF · 1.5 MB' });
    expect(fileCardModel({ mime: 'application/zip', kind: 'file' })).toEqual({ title: 'file attachment', subtitle: 'ZIP' });
  });

  test('formats sizes', () => {
    expect(fileSizeLabel(512)).toBe('512 B');
    expect(fileSizeLabel(20_480)).toBe('20 KB');
    expect(fileSizeLabel(undefined)).toBe('');
  });
});

describe('resolved attachment kind', () => {
  test.each(['audio/webm', 'audio/mp4'])('uses decrypted %s instead of a video filename guess', (mime) => {
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
