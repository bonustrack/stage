import { describe, expect, test } from 'bun:test';
import { opensInApp, savedFileName } from '../src/openableFile';

const bytesOf = (s: string): number => new TextEncoder().encode(s).length;

describe('savedFileName', () => {
  test('keeps a normal name', () => {
    expect(savedFileName('Report 2026.pdf')).toBe('Report 2026.pdf');
  });

  test('cannot leave the folder it is written to', () => {
    expect(savedFileName('../../etc/passwd')).toBe('_.._etc_passwd');
    expect(savedFileName('C:\\Users\\x\\a.txt')).toBe('C__Users_x_a.txt');
    expect(savedFileName('a\u0000b.pdf')).toBe('a_b.pdf');
  });

  test('drops characters that disguise the real extension', () => {
    expect(savedFileName('invoice\u202efdp.exe')).toBe('invoice_fdp.exe');
    expect(savedFileName('a\u200bb.pdf')).toBe('a_b.pdf');
    expect(savedFileName('report.pdf. ')).toBe('report.pdf');
  });

  test('never uses a Windows device name', () => {
    expect(savedFileName('CON.pdf')).toBe('_CON.pdf');
    expect(savedFileName('nul.txt')).toBe('_nul.txt');
    expect(savedFileName('com1')).toBe('_com1');
  });

  test('fits a long name in 200 bytes and keeps its extension', () => {
    const name = savedFileName(`${'文'.repeat(120)}.pdf`);
    expect(bytesOf(name)).toBeLessThanOrEqual(200);
    expect(name.endsWith('.pdf')).toBe(true);
  });

  test('falls back to a plain name when nothing is left', () => {
    expect(savedFileName('')).toBe('attachment');
    expect(savedFileName('...')).toBe('attachment');
  });
});

describe('opensInApp', () => {
  test('opens documents and media that no viewer runs as code', () => {
    for (const name of ['a.pdf', 'A.PDF', 'notes.txt', 'photo.heic', 'clip.mov']) expect(opensInApp(name)).toBe(true);
  });

  test('saves pages, scripts, programs and files that apps may evaluate', () => {
    for (const name of ['page.html', 'run.command', 'Setup.exe', 'tool.app', 'x.sh', 'invoice.pdf.exe', 'data.csv', 'notes.md', 'config.json', 'noextension', '.pdf']) expect(opensInApp(name)).toBe(false);
  });
});
