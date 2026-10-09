import { describe, expect, test } from 'bun:test';
import { opensInApp, savedFileName } from '../src/openableFile';

describe('savedFileName', () => {
  test('keeps a normal name', () => {
    expect(savedFileName('Report 2026.pdf')).toBe('Report 2026.pdf');
  });

  test('cannot leave the folder it is written to', () => {
    expect(savedFileName('../../etc/passwd')).toBe('_.._etc_passwd');
    expect(savedFileName('C:\\Users\\x\\a.txt')).toBe('C__Users_x_a.txt');
    expect(savedFileName('a\u0000b.pdf')).toBe('a_b.pdf');
  });

  test('falls back to a plain name when nothing is left', () => {
    expect(savedFileName('')).toBe('attachment');
    expect(savedFileName('...')).toBe('attachment');
  });
});

describe('opensInApp', () => {
  test('opens documents and media with the system app', () => {
    for (const name of ['a.pdf', 'A.PDF', 'notes.txt', 'data.csv', 'photo.heic', 'clip.mov']) expect(opensInApp(name)).toBe(true);
  });

  test('never opens pages, scripts or programs, which get a save dialog instead', () => {
    for (const name of ['page.html', 'run.command', 'Setup.exe', 'tool.app', 'x.sh', 'invoice.pdf.exe', 'noextension', '.pdf']) expect(opensInApp(name)).toBe(false);
  });
});
