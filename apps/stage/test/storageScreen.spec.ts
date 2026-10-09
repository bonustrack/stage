import { describe, expect, test } from 'bun:test';
import type { StoredFile } from '../lib/storageIndex.model';
import {
  chatLabelOf, extensionOf, scanProgressLabel, storageDateLabel, storageKindOf, storageRows, storageStatusLabel, storageSummary,
} from '../components/storage/StorageScreen.model';

const NONE: ReadonlySet<string> = new Set();
const NOW = new Date(2026, 9, 9, 18, 0).getTime();

function file(messageId: string, name: string, size = 1024, sentMs = NOW): StoredFile {
  return { messageId, convId: 'c1', index: 0, name, size, sentMs };
}

describe('storage page model', () => {
  test('sorts names into types by extension', () => {
    expect(['photo.JPG', 'clip.mov', 'voice.m4a', 'notes.pdf', 'archive.zip', 'README', '.env'].map(storageKindOf))
      .toEqual(['image', 'video', 'audio', 'document', 'other', 'other', 'other']);
    expect(extensionOf('a.tar.gz')).toBe('gz');
    expect(extensionOf('trailing.')).toBe('');
  });

  test('filters by type and name, and hides files deleted on this device', () => {
    const files = [file('a', 'Budget.xlsx'), file('b', 'beach.png'), file('c', 'budget-2.png')];
    const names = (query: string, filter: 'all' | 'image', hidden = NONE): string[] =>
      storageRows(files, { query, filter, hidden }, NOW).map(row => row.file.name);
    expect(names('', 'all')).toEqual(['Budget.xlsx', 'beach.png', 'budget-2.png']);
    expect(names(' BUDGET ', 'all')).toEqual(['Budget.xlsx', 'budget-2.png']);
    expect(names('', 'image')).toEqual(['beach.png', 'budget-2.png']);
    expect(names('', 'all', new Set(['b']))).toEqual(['Budget.xlsx', 'budget-2.png']);
    expect(storageRows(files, { query: '', filter: 'all', hidden: NONE }, NOW)[0]).toMatchObject({ key: 'a:0', kind: 'document' });
  });

  test('labels size, date, totals and scan progress', () => {
    expect(storageRows([file('a', 'a.pdf', 2_500_000)], { query: '', filter: 'all', hidden: NONE }, NOW)[0]?.detail)
      .toBe(`2.4 MB · ${storageDateLabel(NOW, NOW)}`);
    expect(storageDateLabel(new Date(2026, 2, 3).getTime(), NOW)).not.toContain('2026');
    expect(storageDateLabel(new Date(2025, 2, 3).getTime(), NOW)).toContain('2025');
    expect(storageSummary([file('a', 'a', 1024), file('b', 'b', 1024)], NONE)).toBe('2 files · 2 KB');
    expect(storageSummary([file('a', 'a', 0)], NONE)).toBe('1 file');
    expect(storageSummary([file('a', 'a', 1024)], new Set(['a']))).toBe('');
    expect(scanProgressLabel(3, 40)).toBe('Finding your files… 3 of 40 chats');
    expect(scanProgressLabel(0, 0)).toBe('Finding your files…');
    const status = { files: [file('a', 'a', 1024)], scanning: false, firstScan: false, failed: true, done: 2, total: 2 };
    expect(storageStatusLabel(status, NONE)).toBe('1 file · 1 KB · Some chats could not be read');
    expect(storageStatusLabel({ ...status, scanning: true }, NONE)).toBe('1 file · 1 KB');
    expect(storageStatusLabel({ ...status, firstScan: true }, NONE)).toBe('Finding your files… 2 of 2 chats');
  });

  test('names the chat a file was sent in', () => {
    const short = (address: string): string => address.slice(0, 6);
    expect(chatLabelOf({ peerAddress: '0xabcdef12', groupName: '' }, 'Alice', short)).toBe('Alice');
    expect(chatLabelOf({ peerAddress: '0xabcdef12', groupName: '' }, undefined, short)).toBe('0xabcd');
    expect(chatLabelOf({ peerAddress: null, groupName: ' Design ' }, undefined, short)).toBe('Design');
    expect(chatLabelOf({ peerAddress: null, groupName: '' }, undefined, short)).toBe('Unnamed channel');
    expect(chatLabelOf(null, undefined, short)).toBe('');
  });
});
