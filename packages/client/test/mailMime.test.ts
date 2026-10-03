import { describe, expect, test } from 'bun:test';
import { parseMail } from '../src/mail/mime';
import { decodeCharset, decodeWords, parseAddress, parseParams } from '../src/mail/mimeHeaders';

const encode = (lines: string[]): Uint8Array => new TextEncoder().encode(lines.join('\r\n'));

const MIXED = encode([
  'From: =?UTF-8?B?w4lsaWU=?= <elie@example.com>',
  'To: alice1@st.box',
  'Cc: "Doe, John" <john@example.com>',
  'Subject: =?utf-8?Q?Caf=C3=A9_menu?=',
  '  =?utf-8?Q?_today?=',
  'Date: Fri, 3 Oct 2026 10:00:00 +0000',
  'Content-Type: multipart/mixed; boundary="mix"',
  '',
  'This is a preamble.',
  '--mix',
  'Content-Type: multipart/alternative; boundary=alt',
  '',
  '--alt',
  'Content-Type: text/plain; charset=utf-8',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  'Hello caf=C3=A9, a long line that wraps=',
  ' here.',
  '--alt',
  'Content-Type: text/html; charset=utf-8',
  'Content-Transfer-Encoding: base64',
  '',
  'PHA+SGVsbG8gPGI+Y2Fmw6k8L2I+PC9wPg==',
  '--alt--',
  '--mix',
  'Content-Type: image/png; name="logo.png"',
  'Content-ID: <logo@x>',
  'Content-Disposition: inline',
  'Content-Transfer-Encoding: base64',
  '',
  'iVBORw0KGgo=',
  '--mix',
  'Content-Type: application/pdf',
  'Content-Disposition: attachment; filename*=UTF-8\'\'r%C3%A9sum%C3%A9.pdf',
  'Content-Transfer-Encoding: base64',
  '',
  'JVBERi0xLjQK',
  '--mix--',
  'Epilogue is ignored.',
]);

describe('parseMail', () => {
  test('decodes headers, both bodies and the attachments of a nested multipart mail', () => {
    const mail = parseMail(MIXED);
    expect(mail.from).toBe('Élie <elie@example.com>');
    expect(mail.to).toBe('alice1@st.box');
    expect(mail.cc).toBe('"Doe, John" <john@example.com>');
    expect(mail.subject).toBe('Café menu today');
    expect(mail.date).toBe('Fri, 3 Oct 2026 10:00:00 +0000');
    expect(mail.text).toBe('Hello café, a long line that wraps here.');
    expect(mail.html).toBe('<p>Hello <b>café</b></p>');
    expect(mail.attachments.map((a) => [a.filename, a.mimeType, a.size, a.contentId, a.inline])).toEqual([
      ['logo.png', 'image/png', 8, 'logo@x', true],
      ['résumé.pdf', 'application/pdf', 9, null, false],
    ]);
    expect(Array.from(mail.attachments[1]?.content ?? [])).toEqual(Array.from(new TextEncoder().encode('%PDF-1.4\n')));
  });

  test('reads a single part latin-1 mail with LF line ends', () => {
    const bytes = Uint8Array.from([
      ...new TextEncoder().encode('Subject: Hi\nContent-Type: text/plain; charset=iso-8859-1\n\nCaf'), 0xe9, 0x20, 0x80,
    ]);
    const mail = parseMail(bytes);
    expect(mail.subject).toBe('Hi');
    expect(mail.text).toBe('Café €');
    expect(mail.html).toBeNull();
  });

  test('keeps a text part with a file name as an attachment and names unnamed parts', () => {
    const mail = parseMail(encode([
      'Content-Type: multipart/mixed; boundary=b',
      '',
      '--b',
      'Content-Type: text/plain',
      '',
      'Body',
      '--b',
      'Content-Type: text/plain; name="notes.txt"',
      '',
      'Notes',
      '--b',
      'Content-Type: text/calendar',
      'Content-Disposition: attachment',
      '',
      'BEGIN:VCALENDAR',
      '--b--',
    ]));
    expect(mail.text).toBe('Body');
    expect(mail.attachments.map((a) => a.filename)).toEqual(['notes.txt', 'attachment-2.ics']);
  });

  test('survives a missing closing boundary, no header gap and garbage', () => {
    expect(parseMail(encode(['Content-Type: multipart/mixed; boundary=b', '', '--b', 'Content-Type: text/plain', '', 'cut off'])).text).toBe('cut off');
    expect(parseMail(encode(['Subject: only headers'])).subject).toBe('only headers');
    expect(parseMail(new Uint8Array([0, 255, 13, 10, 13, 10, 1])).text).not.toBeNull();
  });
});

describe('mail headers', () => {
  test('decodes encoded words in B and Q form and joins adjacent ones', () => {
    expect(decodeWords('=?UTF-8?B?w6k=?= =?UTF-8?Q?t=C3=A9?= plain')).toBe('été plain');
    expect(decodeWords('=?iso-8859-1?q?caf=E9?=')).toBe('café');
    expect(decodeWords('no words here')).toBe('no words here');
  });

  test('decodes windows-1252 and falls back to utf-8 for unknown charsets', () => {
    expect(decodeCharset(Uint8Array.from([0x93, 0x68, 0x69, 0x94]), 'windows-1252')).toBe('“hi”');
    expect(decodeCharset(new TextEncoder().encode('ok é'), 'x-unknown')).toBe('ok é');
  });

  test('parses quoted and continued parameters', () => {
    const params = parseParams('attachment; filename*0="long "; filename*1="name.txt"; size=12');
    expect(params.value).toBe('attachment');
    expect(params.params.get('filename')).toBe('long name.txt');
    expect(parseParams('text/plain; charset="utf-8"; format=flowed').params.get('charset')).toBe('utf-8');
    expect(parseParams('x; name="a\\"b;c"').params.get('name')).toBe('a"b;c');
  });

  test('reads the display name and address of a sender', () => {
    expect(parseAddress('"Doe, John" <john@example.com>')).toEqual({ name: 'Doe, John', address: 'john@example.com' });
    expect(parseAddress('Ann <ann@example.com>')).toEqual({ name: 'Ann', address: 'ann@example.com' });
    expect(parseAddress('bob@example.com (Bob)')).toEqual({ name: 'Bob', address: 'bob@example.com' });
    expect(parseAddress('carl@example.com')).toEqual({ name: '', address: 'carl@example.com' });
  });
});
