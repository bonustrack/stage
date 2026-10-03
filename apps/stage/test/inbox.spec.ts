import { describe, expect, test } from 'bun:test';
import { deriveMailKey, openMailIndex, openMailPart, sealMailIndex, sealMailPart, type MailIndex } from '@stage-labs/client/mail/mailbox';
import { parseMail } from '@stage-labs/client/mail/mime';
import {
  inboxRows, mailBody, mailReadKey, mailReceivedAt, parseReadKeys, safeFileName, senderLabel, subjectLabel, visibleBlocks,
  withReadKey, type InboxEntry,
} from '../components/settings/Inbox.model';

const index = (from: string, subject: string): MailIndex => ({
  envelopeFrom: 'bounce@example.com', from, to: 'alice1@st.box', subject, date: '', messageId: '<1@x>', size: 10,
});

const ENTRIES: InboxEntry[] = [
  { label: 'alice1', id: '1759400000000-a', ts: 1759400000000, size: 10, index: index('Ann <ann@example.com>', 'Old') },
  { label: 'alice1', id: '1759500000000-b', ts: 1759500000000, size: 10, index: index('=?UTF-8?B?w4lsaWU=?= <e@x.y>', '') },
  { label: 'bobby2', id: '1759450000000-c', ts: 1759450000000, size: 10, index: null },
];

const RAW = [
  'From: Ann <ann@example.com>',
  'To: alice1@st.box',
  'Subject: Report',
  'Content-Type: multipart/related; boundary=r',
  '',
  '--r',
  'Content-Type: text/html; charset=utf-8',
  '',
  '<p>See <a href="https://example.com">this</a></p><img src="cid:logo"><img src="https://img.example/a.png">',
  '--r',
  'Content-Type: image/png',
  'Content-ID: <logo>',
  'Content-Transfer-Encoding: base64',
  '',
  'iVBORw0KGgo=',
  '--r',
  'Content-Type: application/pdf; name="r/../report.pdf"',
  'Content-Disposition: attachment',
  'Content-Transfer-Encoding: base64',
  '',
  'JVBERi0xLjQK',
  '--r--',
].join('\r\n');

describe('inbox list', () => {
  test('sorts newest first, decodes senders and subjects and marks unread mail', () => {
    const read = new Set([mailReadKey('alice1', '1759400000000-a')]);
    const rows = inboxRows(ENTRIES, read, 2);
    expect(rows.map((row) => [row.id, row.sender, row.subject, row.unread, row.to])).toEqual([
      ['1759500000000-b', 'Élie', '(no subject)', true, 'alice1@st.box'],
      ['1759450000000-c', 'Unreadable mail', 'This mail could not be decrypted on this device.', true, 'bobby2@st.box'],
      ['1759400000000-a', 'Ann', 'Old', false, 'alice1@st.box'],
    ]);
    expect(inboxRows(ENTRIES, read, 1).every((row) => row.to === null)).toBe(true);
  });

  test('labels senders and subjects', () => {
    expect(senderLabel('bob@example.com')).toBe('bob@example.com');
    expect(senderLabel('')).toBe('Unknown sender');
    expect(subjectLabel('  =?utf-8?Q?Caf=C3=A9?=  ')).toBe('Café');
  });

  test('keeps read marks unique, capped and parsed defensively', () => {
    expect(withReadKey(['a'], 'a')).toEqual(['a']);
    expect(withReadKey(['a'], 'b')).toEqual(['a', 'b']);
    const many = Array.from({ length: 2000 }, (_, i) => `k${i}`);
    const capped = withReadKey(many, 'new');
    expect(capped.length).toBe(2000);
    expect(capped[0]).toBe('k1');
    expect(parseReadKeys('["a",1,"b"]')).toEqual(['a', 'b']);
    expect(parseReadKeys('{')).toBeUndefined();
  });

  test('reads the receive time from the mail id', () => {
    expect(mailReceivedAt('1759430000000-9ef6fdd0-0635-4130-8b77-aaeae0f65158')).toBe(1759430000000);
    expect(mailReceivedAt('nope')).toBeNull();
  });
});

describe('mail view', () => {
  test('decrypts a sealed mail and its index into the view model', async () => {
    const keys = await deriveMailKey('alice1', () => Promise.resolve(`0x${'ab'.repeat(65)}`));
    const id = '1759430000000-9ef6fdd0-0635-4130-8b77-aaeae0f65158';
    const sealedIndex = sealMailIndex(keys.publicKey, 'alice1', id, index('Ann <ann@example.com>', 'Report'));
    const sealedBody = sealMailPart(keys.publicKey, 'alice1', id, 'body', new TextEncoder().encode(RAW));
    expect(openMailIndex(keys.secretKey, 'alice1', id, sealedIndex).subject).toBe('Report');
    expect(() => openMailPart(keys.secretKey, 'bobby2', id, 'body', sealedBody)).toThrow();
    const mail = parseMail(openMailPart(keys.secretKey, 'alice1', id, 'body', sealedBody));
    const body = mailBody(mail);
    expect(body.remoteImages).toBe(true);
    expect(body.blocks.map((block) => block.type)).toEqual(['text', 'image', 'image']);
    expect(visibleBlocks(body.blocks, false).map((block) => block.type)).toEqual(['text', 'image']);
    expect(visibleBlocks(body.blocks, true)).toHaveLength(3);
    expect(body.attachments.map((row) => [row.title, row.subtitle])).toEqual([['r/../report.pdf', 'PDF · 9 B']]);
    expect(safeFileName(body.attachments[0]?.attachment.filename ?? '')).toBe('r_.._report.pdf');
  });

  test('falls back to the text part and lists inline images when there is no html', () => {
    const mail = parseMail(new TextEncoder().encode([
      'Content-Type: multipart/mixed; boundary=m', '', '--m', 'Content-Type: text/plain', '', 'Hello https://example.com',
      '--m', 'Content-Type: image/png', 'Content-ID: <pic>', 'Content-Transfer-Encoding: base64', '', 'iVBORw0KGgo=', '--m--',
    ].join('\r\n')));
    const body = mailBody(mail);
    expect(body.remoteImages).toBe(false);
    expect(body.blocks).toHaveLength(1);
    expect(body.attachments.map((row) => row.title)).toEqual(['attachment-1.png']);
  });

  test('cleans file names for saving', () => {
    expect(safeFileName('..')).toBe('attachment');
    expect(safeFileName('a\u0007b:c.txt')).toBe('ab_c.txt');
  });
});
