import { describe, expect, mock, test } from 'bun:test';
import { runSyncCheck, syncCheckResult, type SyncCheckInput } from '../lib/syncCheck.model';

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

  test('a restored copy waits for a member and shows no local state', () => {
    const result = syncCheckResult({ ...HEALTHY, restored: true, active: false, syncError: 'MLS Group bb4e Not Found', state: null, newest: '' });
    expect(result.title).toBe('Not in the channel yet');
    expect(result.message.split('\n')).toEqual([
      'This device only has a restored copy of this channel from the history import, so it is not a member yet. It is added when a member next sends a message.',
      'Error: MLS Group bb4e Not Found',
    ]);
  });

  test('a channel whose sync state cannot be read says so', () => {
    expect(syncCheckResult({ ...HEALTHY, state: null }).message).toContain('Could not read the sync state.');
  });

  test('a channel with no messages says so', () => {
    expect(syncCheckResult({ ...HEALTHY, newest: '' }).message).toContain('No messages on this device.');
  });
});

function syncOps() {
  return {
    find: mock((): Promise<string | null> => Promise.resolve('channel')),
    isActive: mock(() => Promise.resolve(true)),
    sync: mock(() => Promise.resolve()),
    details: mock(() => Promise.resolve({ state: HEALTHY.state, newest: HEALTHY.newest })),
  };
}

describe('runSyncCheck', () => {
  test('checks only the chosen channel and reports its state', async () => {
    const ops = syncOps();
    expect(await runSyncCheck(ops)).toEqual(syncCheckResult(HEALTHY));
    expect(ops.isActive).toHaveBeenCalledWith('channel');
    expect(ops.sync).toHaveBeenCalledWith('channel');
    expect(ops.details).toHaveBeenCalledWith('channel');
  });

  test('a missing local channel does not run network sync', async () => {
    const ops = syncOps();
    ops.find.mockResolvedValue(null);
    expect((await runSyncCheck(ops)).title).toBe('Not on this device');
    expect(ops.isActive).not.toHaveBeenCalled();
    expect(ops.sync).not.toHaveBeenCalled();
  });

  test('lookup errors are not misreported as a missing channel', async () => {
    const ops = syncOps();
    ops.find.mockRejectedValue(new Error('lookup failed'));
    expect(await runSyncCheck(ops)).toEqual({
      ok: false, title: 'Couldn’t check sync', message: 'Local channel lookup: lookup failed',
    });
  });

  test('a lookup that fails for want of MLS state names the restored copy', async () => {
    const ops = syncOps();
    ops.find.mockRejectedValue(new Error('[NotFound::MlsGroup] Group error: MLS Group bb4e76e238f67034feae85db784edfd6 Not Found'));
    const result = await runSyncCheck(ops);
    expect(result.title).toBe('Not in the channel yet');
    expect(result.message).toContain('restored copy');
    expect(result.message).toContain('Error: [NotFound::MlsGroup]');
    expect(ops.isActive).not.toHaveBeenCalled();
    expect(ops.sync).not.toHaveBeenCalled();
  });

  test('a membership read that fails for want of MLS state names the restored copy too', async () => {
    const ops = syncOps();
    ops.isActive.mockRejectedValue(new Error('MLS Group bb4e Not Found'));
    expect((await runSyncCheck(ops)).title).toBe('Not in the channel yet');
    expect(ops.sync).not.toHaveBeenCalled();
  });

  test('an inactive channel is not synced', async () => {
    const ops = syncOps();
    ops.isActive.mockResolvedValue(false);
    expect((await runSyncCheck(ops)).title).toBe('Not in the channel yet');
    expect(ops.sync).not.toHaveBeenCalled();
    expect(ops.details).toHaveBeenCalledTimes(1);
  });

  test('a sync rejection retains the available local diagnostics', async () => {
    const ops = syncOps();
    ops.sync.mockRejectedValue(new Error('network unavailable'));
    const result = await runSyncCheck(ops);
    expect(result.title).toBe('Sync failed');
    expect(result.message).toContain('network unavailable');
    expect(result.message).toContain('Epoch: 12');
  });

  for (const [method, phase] of [
    ['find', 'Local channel lookup'],
    ['isActive', 'Channel membership'],
    ['sync', 'Channel network sync'],
    ['details', 'Local sync state and newest message'],
  ] as const) {
    test(`${method} cannot leave the check pending`, async () => {
      const ops = syncOps();
      ops[method].mockImplementation(() => new Promise<never>(() => undefined));
      const result = await runSyncCheck(ops, 20);
      expect(result.ok).toBe(false);
      expect(result.message).toContain(phase);
      expect(result.message).toContain('timed out');
      if (method !== 'details') expect(ops.details).not.toHaveBeenCalled();
    });

    test(`${method} errors cannot report a healthy channel`, async () => {
      const ops = syncOps();
      ops[method].mockRejectedValue(new Error('operation failed'));
      const result = await runSyncCheck(ops);
      expect(result.ok).toBe(false);
      expect(result.message).toContain('operation failed');
    });
  }

  test('a late lookup does not start more operations after timeout', async () => {
    const ops = syncOps();
    const lookup = Promise.withResolvers<string>();
    ops.find.mockImplementation(() => lookup.promise);
    expect((await runSyncCheck(ops, 20)).ok).toBe(false);
    lookup.resolve('channel');
    await lookup.promise;
    expect(ops.isActive).not.toHaveBeenCalled();
    expect(ops.sync).not.toHaveBeenCalled();
  });
});
