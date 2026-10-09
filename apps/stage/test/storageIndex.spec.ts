import { describe, expect, test } from 'bun:test';
import {
  DELETED_LIMIT, FILE_PAGE_SIZE, applyFindings, decodeIndex, deletesToCheck, emptyIndex, encodeIndex, fileKey,
  filesOfMessage, findingsOf, finishScan, nextCursorNs, type ScannedMessage, type StorageIndex, type StoredFile,
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

function file(messageId: string, sentMs: number, index = 0, convId = 'c1'): StoredFile {
  return { messageId, convId, index, name: `${messageId}-${index}.bin`, size: 10, sentMs };
}

function indexWith(fields: Partial<StorageIndex>): StorageIndex {
  return { ...emptyIndex(ME), ...fields };
}

const keys = (index: StorageIndex): string[] => index.files.map(fileKey);
const ids = (index: StorageIndex): string[] => index.files.map(f => f.messageId);

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
    expect(deletesToCheck(indexWith({ files: [file('mine', 1, 0, 'c2')] }), { ...findings, files: [] })).toEqual([]);
  });

  test('merges files once each, newest first, and drops deleted messages for good', () => {
    const start = applyFindings(emptyIndex(ME), { files: [file('a', 1), file('b', 3), file('b', 3, 1)], deletedIds: [] });
    expect(keys(start)).toEqual(['b:0', 'b:1', 'a:0']);
    expect(applyFindings(start, { files: [file('a', 1)], deletedIds: [] })).toBe(start);
    const deleted = applyFindings(start, { files: [file('c', 2)], deletedIds: ['b'] });
    expect(keys(deleted)).toEqual(['c:0', 'a:0']);
    expect(deleted.deleted).toEqual(['b']);
    expect(keys(applyFindings(deleted, { files: [file('b', 3)], deletedIds: [] }))).toEqual(['c:0', 'a:0']);
    const many = Array.from({ length: DELETED_LIMIT }, (_, i) => `d${i}`);
    const full = applyFindings(deleted, { files: [], deletedIds: many });
    expect(full.deleted).toHaveLength(DELETED_LIMIT);
    const shifted = applyFindings(full, { files: [], deletedIds: ['late'] });
    expect(shifted.deleted.at(-1)).toBe('late');
    expect(shifted.deleted).toHaveLength(DELETED_LIMIT);
  });

  test('round-trips through storage and rejects damaged records', () => {
    const index = indexWith({ cursorNs: 1_760_000_000_000 * MS, files: [file('a', 1), file('b', 2)], deleted: ['x'], retry: { c9: 5 } });
    const decoded = decodeIndex(encodeIndex(index));
    expect(decoded?.cursorNs).toBe(index.cursorNs);
    expect(decoded?.retry).toEqual({ c9: 5 });
    expect(decoded && keys(decoded)).toEqual(['b:0', 'a:0']);
    expect(decodeIndex('nope')).toBeNull();
    expect(decodeIndex(JSON.stringify({ v: 2, inboxId: ME, cursorNs: 0 }))).toBeNull();
    const partial = decodeIndex(JSON.stringify({ v: 1, inboxId: ME, cursorNs: 0, files: [{ messageId: 'a' }, file('b', 2)], retry: { c1: 'x' } }));
    expect(partial?.files).toEqual([file('b', 2)]);
    expect(partial?.retry).toEqual({});
  });
});

interface StoredMessage extends ScannedMessage { insertedNs: number }

function fakeChats(chats: Record<string, StoredMessage[]>, failing = new Set<string>()) {
  const queries: (MessageQuery & { conv: string })[] = [];
  const page = (conv: string, query: MessageQuery): Promise<ScannedMessage[]> => {
    queries.push({ ...query, conv });
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
    idOf: (conv) => conv,
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
    const failed = await scanConversations(['c1', 'c2', 'sync'], emptyIndex(ME), source(chats.page), sink);
    expect(failed.size).toBe(0);
    expect(sink.index().files).toHaveLength(long.length);
    expect(sink.progressed).toEqual([1, 2, 3]);
    expect(chats.queries.every(q => q.insertedAfterNs === undefined && q.filesOnly === true)).toBe(true);
    expect(chats.queries.filter(q => q.conv === 'sync')).toEqual([]);
  });

  test('files that share the sent time of a page boundary are all found', async () => {
    const tied = Array.from({ length: FILE_PAGE_SIZE + 1 }, (_, i) => stored(`t${i}`, i < FILE_PAGE_SIZE - 1 ? 2_000 + i : 1_000, 1));
    const chats = fakeChats({ c1: tied });
    const sink = memorySink(emptyIndex(ME));
    await scanConversations(['c1'], emptyIndex(ME), source(chats.page), sink);
    expect(sink.index().files).toHaveLength(tied.length);
  });

  test('a later scan reads only what was stored since, history imports and deletions included', async () => {
    const chats = fakeChats({ c1: [
      stored('old', 1_000, 1_000),
      stored('imported', 500, 9_000),
      stored('fresh', 9_100, 9_100),
      stored('del', 9_200, 9_200, { contentTypeId: 'deleteMessage', content: { messageId: 'kept' } }),
    ] });
    const start = indexWith({ cursorNs: 5_000 * MS, files: [file('kept', 800)] });
    const sink = memorySink(start);
    expect((await scanConversations(['c1'], start, source(chats.page), sink)).size).toBe(0);
    expect(ids(sink.index())).toEqual(['fresh', 'imported']);
    expect(chats.queries[0]).toMatchObject(scanQuery(5_000 * MS, undefined));
    expect(nextCursorNs(1_760_000_000_000)).toBeLessThan(1_760_000_000_000 * MS);
  });

  test('another member can delete my file only as a super admin of that same chat', async () => {
    const del = (id: string, by: string, target: string, convId = 'c1'): StoredMessage =>
      stored(id, 9, 9, { senderInboxId: by, convId, contentTypeId: 'deleteMessage', content: { messageId: target } });
    const chats = fakeChats({
      c1: [stored('f1', 1, 1), stored('f2', 2, 2), stored('f3', 3, 3), del('x1', PEER, 'f1'), del('x2', 'inbox-admin', 'f2')],
      c2: [del('x3', 'inbox-admin', 'f3', 'c2')],
    });
    const sink = memorySink(emptyIndex(ME));
    await scanConversations(['c1', 'c2'], emptyIndex(ME), source(chats.page, { superAdmins: () => Promise.resolve(new Set(['inbox-admin'])) }), sink);
    expect(ids(sink.index())).toEqual(['f3', 'f1']);
  });

  test('a broken chat is retried from its own cursor while the others move on', async () => {
    const chats = fakeChats({ c1: [stored('a', 1, 1)], c2: [stored('b', 2, 2, { convId: 'c2' })] }, new Set(['c1']));
    const errors: unknown[] = [];
    const start = indexWith({ cursorNs: 0 });
    const sink = memorySink(start);
    const failed = await scanConversations(['c1', 'c2'], start, source(chats.page, { failed: (err) => { errors.push(err); } }), sink);
    expect(errors).toHaveLength(1);
    expect([...failed]).toEqual([['c1', 0]]);
    expect(ids(sink.index())).toEqual(['b']);
    const next = finishScan(sink.index(), 7_000 * MS, failed);
    expect(next.retry).toEqual({ c1: 0 });
    const again = fakeChats({ c1: [stored('a', 1, 1)], c2: [] });
    const failedAgain = await scanConversations(['c1', 'c2'], next, source(again.page), memorySink(next));
    expect(failedAgain.size).toBe(0);
    expect(again.queries.find(q => q.conv === 'c1')?.insertedAfterNs).toBeUndefined();
    expect(again.queries.find(q => q.conv === 'c2')?.insertedAfterNs).toBe(7_000 * MS);
  });

  test('a switched account stops the scan before the next query', async () => {
    const chats = fakeChats({ c1: [stored('a', 1, 1)] });
    const stopped = scanConversations(['c1'], emptyIndex(ME), source(chats.page, { current: () => false }), memorySink(emptyIndex(ME)));
    await expect(stopped).rejects.toBeInstanceOf(ScanStopped);
    expect(chats.queries).toEqual([]);
  });
});
