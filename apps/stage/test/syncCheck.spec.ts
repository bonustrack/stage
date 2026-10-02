import { describe, expect, test } from 'bun:test';
import { syncCheckResult, type SyncCheckInput } from '../lib/syncCheck.model';

const HEALTHY: SyncCheckInput = {
  found: true,
  active: true,
  syncError: '',
  state: { epoch: 12, forked: false, forkDetails: '', pausedForVersion: '' },
  newest: '02/10/2026, 20:32:00',
};

describe('syncCheckResult', () => {
  test('a healthy channel is in sync and shows the newest message and epoch', () => {
    const result = syncCheckResult(HEALTHY);
    expect(result.ok).toBe(true);
    expect(result.title).toBe('In sync');
    expect(result.message.split('\n')).toEqual([
      'This device is up to date with this channel.',
      'Newest message here: 02/10/2026, 20:32:00',
      'Epoch: 12',
    ]);
  });

  test('a forked channel says this device lost track and shows the fork details', () => {
    const result = syncCheckResult({
      ...HEALTHY, state: { epoch: 7, forked: true, forkDetails: 'epoch mismatch', pausedForVersion: '' },
    });
    expect(result.ok).toBe(false);
    expect(result.title).toBe('Out of sync');
    expect(result.message).toContain('Details: epoch mismatch');
    expect(result.message).toContain('Epoch: 7');
  });

  test('a paused channel asks for an update before anything else', () => {
    const result = syncCheckResult({
      ...HEALTHY, syncError: 'paused', state: { epoch: 3, forked: true, forkDetails: '', pausedForVersion: '1.11.0' },
    });
    expect(result.title).toBe('Update needed');
    expect(result.message).toContain('1.11.0');
  });

  test('an inactive channel waits for a member to add this device', () => {
    const result = syncCheckResult({ ...HEALTHY, active: false });
    expect(result.title).toBe('Not in the channel yet');
  });

  test('a sync error is shown, clipped to a readable length', () => {
    const result = syncCheckResult({ ...HEALTHY, syncError: 'x'.repeat(500) });
    expect(result.title).toBe('Sync failed');
    const errorLine = result.message.split('\n').find(line => line.startsWith('Error: '));
    expect(errorLine?.length).toBe('Error: '.length + 301);
  });

  test('a channel missing on this device has no details', () => {
    const result = syncCheckResult({ ...HEALTHY, found: false, state: null, newest: '' });
    expect(result).toEqual({ ok: false, title: 'Not on this device', message: 'This device has no copy of this channel yet.' });
  });

  test('a channel whose sync state cannot be read says so', () => {
    expect(syncCheckResult({ ...HEALTHY, state: null }).message).toContain('Could not read the sync state.');
  });

  test('a channel with no messages says so', () => {
    expect(syncCheckResult({ ...HEALTHY, newest: '' }).message).toContain('No messages on this device.');
  });
});
