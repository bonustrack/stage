import { describe, expect, test } from 'bun:test';
import { transferStepLabel } from '../lib/historyTransfer.model';

describe('transferStepLabel', () => {
  test('names each step and shows key progress as a percentage', () => {
    expect(transferStepLabel({ kind: 'unlocking', share: 0.424 })).toBe('Unlocking your history... 42%');
    expect(transferStepLabel({ kind: 'locking', share: 1.2 })).toBe('Locking with the code... 100%');
    expect(transferStepLabel({ kind: 'downloading' })).toBe('Downloading...');
    expect(transferStepLabel({ kind: 'importing' })).toBe('Importing your messages...');
    expect(transferStepLabel({ kind: 'packing' })).toBe('Packing your messages...');
    expect(transferStepLabel({ kind: 'uploading' })).toBe('Uploading...');
  });

  test('idle has no label so the sheet keeps its own copy', () => {
    expect(transferStepLabel({ kind: 'idle' })).toBeNull();
  });
});
