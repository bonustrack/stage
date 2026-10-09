import { describe, expect, test } from 'bun:test';
import { fileOpenAction } from '../lib/fileOpen.model';

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
    expect(action.kind === 'openInline' && action.mime).toBe('text/csv;charset=iso-8859-1');
  });

  test('opens a decrypted or remote file link as it is', () => {
    expect(fileOpenAction({ url: 'blob:https://stage.box/abc', mime: 'application/pdf', name: 'a.pdf' })).toEqual({ kind: 'open', url: 'blob:https://stage.box/abc' });
    expect(fileOpenAction({ url: 'https://example.com/a.txt', mime: 'text/plain', name: 'a.txt' })).toEqual({ kind: 'open', url: 'https://example.com/a.txt' });
  });

  test('downloads files a browser tab cannot show', () => {
    expect(fileOpenAction(inline('PK', 'application/zip'))).toEqual({ kind: 'download' });
    expect(fileOpenAction({ url: 'blob:https://stage.box/abc', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', name: 'a.docx' })).toEqual({ kind: 'download' });
    expect(fileOpenAction({ url: 'blob:https://stage.box/abc', name: 'unknown' })).toEqual({ kind: 'download' });
  });
});
