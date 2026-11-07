import { describe, expect, test } from 'bun:test';
import { fileCardModel, fileSizeLabel } from '../components/media/fileCard.model';

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
