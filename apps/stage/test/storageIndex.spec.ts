import { describe, expect, test } from 'bun:test';
import {
  DELETED_LIMIT, FILE_PAGE_SIZE, applyFindings, decodeIndex, deletesToCheck, emptyIndex, encodeIndex, fileKey,
  filesOfMessage, findingsOf, nextCursorNs, type ScannedMessage, type StorageIndex, type StoredFile,
} from '../lib/storageIndex.model';
import { ScanStopped, scanConversations, scanQuery, type ScanSink, type ScanSource } from '../lib/storageScan.model';
import type { MessageQuery } from '../lib/xmtp.sdk.core';

const ME = 'inbox-me';
const PEER = 'inbox-peer';
const MS = 1_000_000;

function message(id: string, fields: Partial<ScannedMessage> = {}): ScannedMessage {
  return {
    id, convId: 'c1', senderInboxId: ME, sentNs: 1_700_000_000_000 * MS,
    contentTypeId: 'xmtp.org/multiRemoteStaticAttachment:1.0',
    content: { attachments: [{ filename: `${id}.pdf`, contentLength: '2048', url: 'https://x' }] },
    ...fields,
  };
}

function file(messageId: string, sentMs: number, index = 0): StoredFile {
  return { messageId, convId: 'c1', index, name: `${messageId}-${index}.bin`, size: 10, sentMs };
}

const keys = (index: StorageIndex): string[] => index.files.map(fileKey);

describe('storage index model', () => {
  test('reads every file of a message with its position, name and size', () => {
    const multi = message('m1', { content: { attachments: [
      { filename: 'a.png', contentLength: 12n },
      { filename: ' ', contentLength: 'oops' },
      { contentLength: 30 },
    ] } });
    expect(filesOfMessage(multi).map(f => [f.index, f.name, f.size])).toEqual([
      [0, 'a.png', 12], [1, 'attachment-2', 0], [2, 'attachment-3', 30],
    ]);
    const webInline = message('m2', { contentTypeId: 'attachment', content: { filename: 'v.m4a', content: new Uint8Array(5) } });
    const nativeInline = message('m3', { contentTypeId: 'xmtp.org/attachment:1.0', content: { filename: 'n.txt', data: 'AAAAAA==' } });
    const single = message('m4', { contentTypeId: 'remoteStaticAttachment', content: { url: 'https://x', contentLength: 99 } });
    expect(filesOfMessage(webInline)[0]?.size).toBe(5);
    expect(filesOfMessage(nativeInline)[0]?.size).toBe(4);
    expect(filesOfMessage(single)[0]).toMatchObject({ name: 'attachment', size: 99, index: 0, sentMs: 1_700_000_000_000 });
    expect(filesOfMessage(message('t', { contentTypeId: 'text', content: 'hi' }))).toEqual([]);
  });

  test('keeps only files I sent and collects deletions', () => {
    const findings = findingsOf([
      message('mine'),
      message('theirs', { senderInboxId: PEER }),
      message('gone', { contentTypeId: 'deletedMessage', content: { deletedBy: 'sender' } }),
      message('del1', { contentTypeId: 'xmtp.org/deleteMessage:1.0', content: { messageId: 'old' } }),
      message('del2', { contentTypeId: 'deleteMessage', senderInboxId: PEER, content: { messageId: 'mine' } }),
      message('del3', { contentTypeId: 'deleteMessage', content: {} }),
    ], ME);
    expect(findings.files.map(f => f.messageId)).toEqual(['mine']);
    expect(findings.deletedIds).toEqual(['gone', 'old']);
    expect(findings.foreignDeletes).toEqual([{ convId: 'c1', target: 'mine', by: PEER }]);
    expect(deletesToCheck(emptyIndex(ME), findings)).toEqual(findings.foreignDeletes);
    expect(deletesToCheck(emptyIndex(ME), { ...findings, files: [] })).toEqual([]);
  });

  test('merges files once each, newest first, and drops deleted messages for good', () => {
    const start = applyFindings(emptyIndex(ME), { files: [file('a', 1), file('b', 3), file('b', 3, 1)], deletedIds: [] });
    expect(keys(start)).toEqual(['b:0', 'b:1', 'a:0']);
    expect(applyFindings(start, { files: [file('a', 1)], deletedIds: [] })).toBe(start);
    const deleted = applyFindings(start, { files: [file('c', 2)], deletedIds: ['b'] });
    expect(keys(deleted)).toEqual(['c:0', 'a:0']);
    expect(deleted.deleted).toEqual(['b']);
    expect(keys(applyFindings(deleted, { files: [file('b', 3)], deletedIds: [] }))).toEqual(['c:0', 'a:0']);
    const many = Array.from({ length: DELETED_LIMIT + 5 }, (_, i) => `d${i}`);
    expect(applyFindings(deleted, { files: [], deletedIds: many }).deleted).toHaveLength(DELETED_LIMIT);
  });

  test('round-trips through storage and rejects damaged records', () => {
    const index: StorageIndex = { inboxId: ME, cursorNs: 1_760_000_000_000 * MS, files: [file('a', 1), file('b', 2)], deleted: ['x'] };
    const decoded = decodeIndex(encodeIndex(index));
    expect(decoded?.cursorNs).toBe(index.cursorNs);
    expect(decoded && keys(decoded)).toEqual(['b:0', 'a:0']);
    expect(decodeIndex('nope')).toBeNull();
    expect(decodeIndex(JSON.stringify({ v: 2, inboxId: ME, cursorNs: 0 }))).toBeNull();
    expect(decodeIndex(JSON.stringify({ v: 1, inboxId: ME, cursorNs: 0, files: [{ messageId: 'a' }, file('b', 2)] }))?.files)
      .toEqual([file('b', 2)]);
  });
});

interface StoredMessage extends ScannedMessage { insertedNs: number }

function fakeChats(chats: Record<string, StoredMessage[]>, failing = new Set<string>()) {
  const queries: MessageQuery[] = [];
  const page = (conv: string, query: MessageQuery): Promise<ScannedMessage[]> => {
    queries.push(query);
    if (failing.has(conv)) return Promise.reject(new Error('broken chat'));
    const rows = (chats[conv] ?? [])
      .filter(m => query.insertedAfterNs === undefined || m.insertedNs > query.insertedAfterNs)
      .filter(m => query.beforeNs === undefined || m.sentNs < query.beforeNs)
      .sort((a, b) => b.sentNs - a.sentNs)
      .slice(0, query.limit);
    return Promise.resolve(rows);
  };
  return { queries, page };
}

function memorySink(start: StorageIndex): ScanSink & { progressed: number[] } {
  let index = start;
  const progressed: number[] = [];
  return {
    progressed,
    index: () => index,
    apply: (findings) => { index = applyFindings(index, findings); },
    progress: (done) => { progressed.push(done); },
  };
}

function source(page: ScanSource<string>['page'], overrides: Partial<ScanSource<string>> = {}): ScanSource<string> {
  return {
    page,
    skip: (conv) => Promise.resolve(conv === 'sync'),
    superAdmins: () => Promise.resolve(new Set<string>()),
    current: () => true,
    failed: () => undefined,
    ...overrides,
  };
}

function stored(id: string, sentMs: number, insertedMs: number, fields: Partial<ScannedMessage> = {}): StoredMessage {
  return { ...message(id, fields), sentNs: sentMs * MS, insertedNs: insertedMs * MS };
}

describe('storage scan', () => {
  test('a first scan pages through every chat, skips the sync channel and reports progress', async () => {
    const long = Array.from({ length: FILE_PAGE_SIZE * 2 + 3 }, (_, i) => stored(`m${i}`, 1_000 + i, 1_000 + i));
    const chats = fakeChats({ c1: long, c2: [stored('p', 5, 5, { convId: 'c2', senderInboxId: PEER })], sync: [stored('s', 6, 6)] });
    const sink = memorySink(emptyIndex(ME));
    const complete = await scanConversations(['c1', 'c2', 'sync'], 0, source(chats.page), sink);
    expect(complete).toBe(true);
    expect(sink.index().files).toHaveLength(long.length);
    expect(sink.progressed).toEqual([1, 2, 3]);
    expect(chats.queries.every(q => q.insertedAfterNs === undefined && q.filesOnly === true)).toBe(true);
    expect(chats.queries.filter(q => q.beforeNs !== undefined)).toHaveLength(2);
  });

  test('a later scan reads only what was stored since, history imports and deletions included', async () => {
    const chats = fakeChats({ c1: [
      stored('old', 1_000, 1_000),
      stored('imported', 500, 9_000),
      stored('fresh', 9_100, 9_100),
      stored('del', 9_200, 9_200, { contentTypeId: 'deleteMessage', content: { messageId: 'kept' } }),
    ] });
    const start: StorageIndex = { inboxId: ME, cursorNs: 5_000 * MS, files: [file('kept', 800)], deleted: [] };
    const sink = memorySink(start);
    expect(await scanConversations(['c1'], start.cursorNs, source(chats.page), sink)).toBe(true);
    expect(sink.index().files.map(f => f.messageId)).toEqual(['fresh', 'imported']);
    expect(chats.queries[0]).toEqual(scanQuery(5_000 * MS, undefined));
    expect(nextCursorNs(1_760_000_000_000)).toBeLessThan(1_760_000_000_000 * MS);
  });

  test('another member can delete my file only as a super admin', async () => {
    const chats = fakeChats({ c1: [
      stored('f1', 1, 1), stored('f2', 2, 2),
      stored('x1', 3, 3, { senderInboxId: PEER, contentTypeId: 'deleteMessage', content: { messageId: 'f1' } }),
      stored('x2', 4, 4, { senderInboxId: 'inbox-admin', contentTypeId: 'deleteMessage', content: { messageId: 'f2' } }),
    ] });
    const sink = memorySink(emptyIndex(ME));
    await scanConversations(['c1'], 0, source(chats.page, { superAdmins: () => Promise.resolve(new Set(['inbox-admin'])) }), sink);
    expect(sink.index().files.map(f => f.messageId)).toEqual(['f1']);
  });

  test('a broken chat leaves the scan incomplete, and a switched account stops it', async () => {
    const chats = fakeChats({ c1: [stored('a', 1, 1)], c2: [stored('b', 2, 2, { convId: 'c2' })] }, new Set(['c1']));
    const errors: unknown[] = [];
    const sink = memorySink(emptyIndex(ME));
    expect(await scanConversations(['c1', 'c2'], 0, source(chats.page, { failed: (err) => { errors.push(err); } }), sink)).toBe(false);
    expect(errors).toHaveLength(1);
    expect(sink.index().files.map(f => f.messageId)).toEqual(['b']);
    const stopped = scanConversations(['c2'], 0, source(chats.page, { current: () => false }), memorySink(emptyIndex(ME)));
    await expect(stopped).rejects.toBeInstanceOf(ScanStopped);
  });
});
