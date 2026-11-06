import { describe, expect, test } from 'bun:test';
import { isImportReplay } from '../src/xmtp/historyImport';

describe('isImportReplay', () => {
  test('messages at or before the import are replays, later ones are live', () => {
    expect(isImportReplay(100, 200)).toBe(true);
    expect(isImportReplay(200, 200)).toBe(true);
    expect(isImportReplay(201, 200)).toBe(false);
  });

  test('without an import nothing is a replay', () => {
    expect(isImportReplay(100, 0)).toBe(false);
    expect(isImportReplay(0, 200)).toBe(false);
  });
});
