import { describe, expect, test } from 'bun:test';
import { fileOpenAction, inertBlobType, nativeFileName } from '../lib/fileOpen.model';

const b64 = (text: string): string => Buffer.from(text, 'utf8').toString('base64');

function inline(text: string, mime: string): { url: string; mime: string; name: string } {
  return { url: `data:${mime};base64,${b64(text)}`, mime, name: 'file' };
}

describe('fileOpenAction', () => {
  test('opens an inline PDF from its bytes instead of a data link', () => {
    const action = fileOpenAction(inline('%PDF-1.4 test', 'application/pdf'));
    expect(action.kind).toBe('openInline');
    if (action.kind !== 'openInline') return;
    expect(action.mime).toBe('application/pdf');
    expect(new TextDecoder().decode(action.bytes)).toBe('%PDF-1.4 test');
  });

  test('gives inline text a utf-8 charset so accents show', () => {
    const action = fileOpenAction(inline('Grüezi und Ciao', 'text/plain'));
    expect(action.kind).toBe('openInline');
    if (action.kind !== 'openInline') return;
    expect(action.mime).toBe('text/plain;charset=utf-8');
    expect(new TextDecoder().decode(action.bytes)).toBe('Grüezi und Ciao');
  });

  test('keeps a charset the file already declares', () => {
    const action = fileOpenAction(inline('hello', 'text/csv;charset=iso-8859-1'));
    expect(action.kind === 'openInline' && action.mime).toBe('text/plain;charset=iso-8859-1');
  });

  test('shows an HTML or XML file as plain text instead of running it', () => {
    for (const mime of ['text/html', 'text/xml', 'TEXT/HTML; charset=utf-8']) {
      const action = fileOpenAction(inline('<script>alert(1)</script>', mime));
      expect(action.kind === 'openInline' && action.mime).toBe('text/plain;charset=utf-8');
    }
  });

  test('opens a blob link through an inert copy, even a file the user sent', () => {
    expect(fileOpenAction({ url: 'blob:https://stage.box/abc', mime: 'application/pdf', name: 'a.pdf' })).toEqual({ kind: 'openBlob', url: 'blob:https://stage.box/abc', mime: 'application/pdf' });
    expect(fileOpenAction({ url: 'blob:https://stage.box/own', mime: 'text/html', name: 'page.html' })).toEqual({ kind: 'openBlob', url: 'blob:https://stage.box/own', mime: 'text/plain;charset=utf-8' });
  });

  test('opens any other link as it is', () => {
    expect(fileOpenAction({ url: 'https://example.com/a.txt', mime: 'text/plain', name: 'a.txt' })).toEqual({ kind: 'open', url: 'https://example.com/a.txt' });
  });

  test('downloads files a browser tab cannot show', () => {
    expect(fileOpenAction(inline('PK', 'application/zip'))).toEqual({ kind: 'download' });
    expect(fileOpenAction({ url: 'blob:https://stage.box/abc', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', name: 'a.docx' })).toEqual({ kind: 'download' });
    expect(fileOpenAction({ url: 'blob:https://stage.box/abc', name: 'unknown' })).toEqual({ kind: 'download' });
  });
});

describe('inertBlobType', () => {
  test('keeps media types that a browser shows without running code', () => {
    expect(inertBlobType('image/png')).toBe('image/png');
    expect(inertBlobType('image/jpg')).toBe('image/jpg');
    expect(inertBlobType('video/mp4')).toBe('video/mp4');
    expect(inertBlobType('audio/mp4; codecs=mp4a.40.2')).toBe('audio/mp4');
    expect(inertBlobType('application/pdf')).toBe('application/pdf');
  });

  test('turns every text type into plain text and keeps a clean charset', () => {
    expect(inertBlobType('text/html')).toBe('text/plain;charset=utf-8');
    expect(inertBlobType('text/plain;charset=ISO-8859-1')).toBe('text/plain;charset=ISO-8859-1');
    expect(inertBlobType('text/plain;charset="><script>')).toBe('text/plain;charset=utf-8');
    expect(inertBlobType(' text/html')).toBe('text/plain;charset=utf-8');
    expect(inertBlobType('text/plain;xcharset=utf-16')).toBe('text/plain;charset=utf-8');
  });

  test('makes anything that could run code an opaque download', () => {
    for (const mime of ['image/svg+xml', 'image/svg+xml; charset=utf-8', 'audio/svg+xml', 'video/x-foo+xml', 'video/mp4,text/html', 'application/xhtml+xml', 'application/xml', 'application/javascript', 'application/octet-stream', '', undefined]) {
      expect(inertBlobType(mime)).toBe('application/octet-stream');
    }
  });
});

describe('nativeFileName', () => {
  test('keeps a normal name with its extension', () => {
    expect(nativeFileName('Report 2026.pdf', 'application/pdf')).toBe('Report 2026.pdf');
  });

  test('adds an extension from the type when the name has none', () => {
    expect(nativeFileName('file attachment', 'application/pdf')).toBe('file attachment.pdf');
    expect(nativeFileName('', 'text/plain; charset=utf-8')).toBe('attachment.txt');
    expect(nativeFileName('notes', 'application/x-unknown')).toBe('notes');
  });

  test('replaces folders and reserved characters so the copy stays in the cache folder', () => {
    expect(nativeFileName('../../secret/a:b*c.txt', 'text/plain')).toBe('_.._secret_a_b_c.txt');
    expect(nativeFileName('a\u0000b.pdf', 'application/pdf')).toBe('a_b.pdf');
  });
});
