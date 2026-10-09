import { describe, expect, test } from 'bun:test';
import { isSvgAttachment, resolvedAttachmentKind } from '../components/bubble/fileCard.model';

describe('SVG attachments', () => {
  test('are recognised by type or by name', () => {
    expect(isSvgAttachment({ mime: 'image/svg+xml' })).toBe(true);
    expect(isSvgAttachment({ mime: 'IMAGE/SVG+XML; charset=utf-8' })).toBe(true);
    expect(isSvgAttachment({ name: 'logo.SVG' })).toBe(true);
    expect(isSvgAttachment({ name: 'logo.svgz' })).toBe(true);
    expect(isSvgAttachment({ mime: 'image/png', name: 'photo.png' })).toBe(false);
  });

  test('show as files instead of pictures, since an SVG can carry code', () => {
    expect(resolvedAttachmentKind({ kind: 'image', mime: 'image/svg+xml', name: 'logo.svg' })).toBe('file');
    expect(resolvedAttachmentKind({ kind: 'image', name: 'logo.svg' })).toBe('file');
    expect(resolvedAttachmentKind({ kind: 'image', mime: 'image/png', name: 'photo.png' })).toBe('image');
    expect(resolvedAttachmentKind({ kind: 'file', mime: 'audio/mp4' })).toBe('audio');
  });
});
