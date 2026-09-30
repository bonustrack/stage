import { describe, expect, test } from 'bun:test';
import { assignedAddresses, clearAppDataWrites, groupAssignedOf, writeAssigned, writeLabels, type Group } from '../src/xmtp/labels';
import { currentMemberAddresses } from '../src/xmtp/groups';

const A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const members = (): Promise<string[]> => Promise.resolve([A, B]);

function fixture(initial = '{}'): { group: Group; raw: () => string; writes: () => number } {
  let raw = initial;
  let writes = 0;
  return {
    group: {
      appData: () => Promise.resolve(raw),
      updateAppData: value => { raw = value; writes += 1; return Promise.resolve(); },
    },
    raw: () => raw,
    writes: () => writes,
  };
}

describe('channel assignees', () => {
  test('normalizes valid addresses, preserving zero and multiple assignees', () => {
    expect(assignedAddresses([` ${A.toUpperCase().replace('0X', '0x')} `, A, B, 2, 'bad'])).toEqual([A, B]);
    expect(assignedAddresses(undefined)).toEqual([]);
    expect(assignedAddresses({ assigned: [A] })).toEqual([]);
  });

  test('reads both SDK appData shapes and defaults old channels to no assignees', async () => {
    const stringGroup = { appData: JSON.stringify({ assigned: [A, B] }), updateAppData: () => Promise.resolve() };
    expect(await groupAssignedOf(stringGroup)).toEqual([A, B]);
    expect(await groupAssignedOf(fixture(JSON.stringify({ assigned: [A] })).group)).toEqual([A]);
    for (const raw of ['', '{', '[]', 'null', '{"labels":["Todo"]}']) {
      expect(await groupAssignedOf(fixture(raw).group)).toEqual([]);
    }
    expect(await groupAssignedOf({})).toEqual([]);
  });

  test('syncs before merging and preserves labels, links and unknown fields', async () => {
    const state = fixture();
    state.group.sync = () => state.group.updateAppData(JSON.stringify({ labels: ['Todo'], github: 'https://github.com/a/b', preview: 'https://example.com', custom: 7 }));
    expect(await writeAssigned(state.group, [A, B], members)).toEqual([A, B]);
    expect(JSON.parse(state.raw())).toEqual({ v: 1, labels: ['Todo'], github: 'https://github.com/a/b', preview: 'https://example.com', custom: 7, assigned: [A, B] });
    delete state.group.sync;
    expect(await writeLabels(state.group, labels => [...labels, 'Stage'])).toEqual(['Todo', 'Stage']);
    expect(JSON.parse(state.raw()).assigned).toEqual([A, B]);
    await writeAssigned(state.group, [], members);
    expect(JSON.parse(state.raw()).assigned).toEqual([]);
  });

  test('rejects invalid addresses and non-members without writing', async () => {
    const state = fixture();
    await expect(writeAssigned(state.group, ['bad'], members)).rejects.toThrow('valid channel members');
    await expect(writeAssigned(state.group, [A], () => Promise.resolve([B]))).rejects.toThrow('current channel members');
    expect(state.writes()).toBe(0);
  });

  test('checks current membership after syncing, including self', async () => {
    let current: string[] = [];
    const state = fixture();
    state.group.sync = () => { current = [A, B]; return Promise.resolve(); };
    await writeAssigned(state.group, [A], () => Promise.resolve(current));
    expect(await groupAssignedOf(state.group)).toEqual([A]);
  });

  test('failed sync, membership read and denied writes propagate', async () => {
    const state = fixture();
    state.group.sync = () => Promise.reject(new Error('offline'));
    await expect(writeAssigned(state.group, [A], members)).rejects.toThrow('offline');
    delete state.group.sync;
    await expect(writeAssigned(state.group, [A], () => Promise.reject(new Error('members unavailable')))).rejects.toThrow('members unavailable');
    state.group.updateAppData = () => Promise.reject(new Error('permission denied'));
    await expect(writeAssigned(state.group, [A], members)).rejects.toThrow('permission denied');
    expect(state.writes()).toBe(0);
  });

  test('serializes local label and assignee writes even across SDK instances', async () => {
    const state = fixture('{"custom":1}');
    const first = { ...state.group, id: 'shared-channel' };
    const second = { ...state.group, id: 'shared-channel' };
    await Promise.all([
      writeAssigned(first, [A], members),
      writeLabels(second, () => ['Stage']),
      writeAssigned(first, [A, B], members),
    ]);
    expect(JSON.parse(state.raw())).toEqual({ v: 1, custom: 1, labels: ['Stage'], assigned: [A, B] });
  });

  test('validates all linked addresses by current member inbox, including secondary self addresses', async () => {
    const resolve = (address: string): Promise<string | undefined> => Promise.resolve(address === A || address === B ? 'self-inbox' : undefined);
    expect(await currentMemberAddresses([A, B], ['self-inbox'], resolve)).toEqual([A, B]);
    expect(await currentMemberAddresses([A, B], ['other-inbox'], resolve)).toEqual([]);
    await expect(currentMemberAddresses([A], ['self-inbox'], () => Promise.reject(new Error('unavailable')))).rejects.toThrow('unavailable');
  });

  test('reset releases the queue from a dead client and cancels old pending edits', async () => {
    const stalled = Promise.withResolvers<undefined>();
    const old = fixture();
    old.group.id = 'reset-channel';
    old.group.sync = () => stalled.promise;
    const pending = writeAssigned(old.group, [A], members);
    const queued = writeLabels(old.group, () => ['Stage']);
    const results = Promise.allSettled([pending, queued]);
    clearAppDataWrites();
    const fresh = fixture();
    fresh.group.id = 'reset-channel';
    await writeAssigned(fresh.group, [B], members);
    expect(await groupAssignedOf(fresh.group)).toEqual([B]);
    stalled.resolve(undefined);
    expect((await results).map(result => result.status)).toEqual(['rejected', 'rejected']);
    expect(old.writes()).toBe(0);
  });

  test('merges fresh metadata after an asynchronous membership check', async () => {
    const state = fixture('{"labels":["Todo"]}');
    await writeAssigned(state.group, [A], async () => {
      await state.group.updateAppData('{"labels":["Stage"],"github":"https://github.com/a/b"}');
      return [A];
    });
    expect(JSON.parse(state.raw())).toEqual({ v: 1, labels: ['Stage'], github: 'https://github.com/a/b', assigned: [A] });
  });

  test('a rejected write does not block the next edit', async () => {
    const state = fixture();
    const denied = { ...state.group, id: 'retry-channel', updateAppData: () => Promise.reject(new Error('permission')) };
    const allowed = { ...state.group, id: 'retry-channel' };
    const results = await Promise.allSettled([writeAssigned(denied, [A], members), writeAssigned(allowed, [B], members)]);
    expect(results.map(result => result.status)).toEqual(['rejected', 'fulfilled']);
    expect(await groupAssignedOf(allowed)).toEqual([B]);
  });
});
