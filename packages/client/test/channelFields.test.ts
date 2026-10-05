import { describe, expect, test } from 'bun:test';
import {
  CHANNEL_PRIORITIES, channelFieldOf, groupTagsOf, LabelPermissionError, NO_TAGS, priorityOf,
  writeAssigned, writeCategory, writeChannelField, writeLabels, type ChannelField, type Group,
} from '../src/xmtp/labels';
import { describeAppDataChange } from '../src/xmtp/appDataChange';
import { appDataGroup } from './helpers';

const address = '0x1111111111111111111111111111111111111111';
const kept = { v: 1, labels: ['Todo'], category: 'Work', assigned: [address], github: 'https://github.com/example/repo', custom: { value: 7 } };
const fields: ChannelField[] = ['status', 'priority'];

describe('channel status and priority', () => {
  test('normalizes status like category and uses the exact priority options', () => {
    expect(channelFieldOf('status', '  Needs   review ')).toBe('Needs review');
    expect(channelFieldOf('status', 'x'.repeat(40))).toBe('x'.repeat(24));
    expect(CHANNEL_PRIORITIES).toEqual(['Urgent', 'High', 'Medium', 'Low']);
    for (const priority of CHANNEL_PRIORITIES) expect(priorityOf(` ${priority} `)).toBe(priority);
    for (const value of [undefined, null, '', '   ', 7, ['Work'], { name: 'Work' }]) {
      expect(channelFieldOf('status', value)).toBeNull();
      expect(priorityOf(value)).toBeNull();
    }
    expect(priorityOf('high')).toBeNull();
    expect(priorityOf('Other')).toBeNull();
  });

  test('reads both SDK appData shapes and keeps old channels compatible', async () => {
    const raw = JSON.stringify({ ...kept, status: ' Needs review ', priority: 'High' });
    const native = appDataGroup(raw).group;
    const web: Group = { appData: raw, updateAppData: () => Promise.resolve() };
    for (const group of [native, web]) {
      expect(await groupTagsOf(group)).toEqual({ labels: ['Todo'], category: 'Work', status: 'Needs review', priority: 'High', assigned: [address] });
    }
    for (const rawValue of ['', '{', '[]', JSON.stringify({ status: [], priority: 7 })]) {
      expect(await groupTagsOf(appDataGroup(rawValue).group)).toEqual(NO_TAGS);
    }
    expect(await groupTagsOf(appDataGroup(JSON.stringify(kept)).group)).toEqual({ ...NO_TAGS, labels: ['Todo'], category: 'Work', assigned: [address] });
  });

  test.each(fields)('sets, replaces and clears %s without changing other metadata', async field => {
    const other = field === 'status' ? { priority: 'Medium' } : { status: 'Waiting' };
    const initial = { ...kept, ...other };
    const state = appDataGroup(JSON.stringify(initial));
    const [first, second] = field === 'status' ? [' Needs review ', 'Ready'] : [' High ', 'Low'];
    expect(await writeChannelField(state.group, field, first ?? null)).toBe(first?.trim() ?? null);
    expect(JSON.parse(state.raw())).toEqual({ ...initial, [field]: first?.trim() });
    await writeChannelField(state.group, field, second ?? null);
    expect(JSON.parse(state.raw())).toEqual({ ...initial, [field]: second });
    for (const clear of [null, '', '   ']) {
      expect(await writeChannelField(state.group, field, clear)).toBeNull();
      expect(JSON.parse(state.raw())).toEqual(initial);
    }
  });

  test('a guarded status rename or clear matches the source column without changing other metadata', async () => {
    const state = appDataGroup(JSON.stringify({ ...kept, status: 'todo' }));
    expect(await writeChannelField(state.group, 'status', 'Doing', 'Todo')).toBe('Doing');
    expect(JSON.parse(state.raw())).toEqual({ ...kept, status: 'Doing' });
    expect(await writeChannelField(state.group, 'status', null, 'Doing')).toBeNull();
    expect(JSON.parse(state.raw())).toEqual(kept);
  });

  test.each([null, 'Doing'])('a guarded status change to %s preserves a newer status found by sync', async next => {
    const writes: string[] = [];
    const fresh = JSON.stringify({ ...kept, status: 'Done' });
    const group: Group = {
      appData: JSON.stringify({ ...kept, status: 'Todo' }),
      sync: () => { group.appData = fresh; return Promise.resolve(); },
      updateAppData: value => { writes.push(value); return Promise.resolve(); },
    };
    await expect(writeChannelField(group, 'status', next, 'Todo')).rejects.toThrow('The status changed. Try again.');
    expect(group.appData).toBe(fresh);
    expect(writes).toEqual([]);
  });

  test('checks the expected source status after earlier queued writes finish', async () => {
    const state = appDataGroup(JSON.stringify({ ...kept, status: 'Todo' }));
    const group = { ...state.group, id: 'guarded-status' };
    const results = await Promise.allSettled([
      writeChannelField(group, 'status', 'Done'),
      writeChannelField({ ...group }, 'status', null, 'Todo'),
    ]);
    expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected']);
    expect(JSON.parse(state.raw())).toEqual({ ...kept, status: 'Done' });
    expect(state.writes()).toBe(1);
  });

  test('refuses an unknown priority without changing stored metadata', async () => {
    const initial = JSON.stringify({ ...kept, priority: 'High' });
    const state = appDataGroup(initial);
    await expect(writeChannelField(state.group, 'priority', 'Other')).rejects.toThrow('Choose a valid priority.');
    expect(state.raw()).toBe(initial);
    expect(state.writes()).toBe(0);
  });

  test('shares the category, label and assignee write queue', async () => {
    const state = appDataGroup(JSON.stringify(kept));
    const group = { ...state.group, id: 'channel-fields' };
    await Promise.all([
      writeChannelField(group, 'status', 'Review'),
      writeChannelField({ ...group }, 'priority', 'Urgent'),
      writeCategory(group, 'Stage'),
      writeLabels(group, labels => [...labels, 'Feature']),
      writeAssigned(group, [], () => Promise.resolve([address])),
    ]);
    expect(JSON.parse(state.raw())).toEqual({ ...kept, category: 'Stage', status: 'Review', priority: 'Urgent', labels: ['Todo', 'Feature'], assigned: [] });
  });

  test.each(fields)('reports a permission error for %s', async field => {
    const group: Group = { appData: '', updateAppData: () => Promise.reject(new Error('not authorized')) };
    const failure = writeChannelField(group, field, 'High');
    await expect(failure).rejects.toBeInstanceOf(LabelPermissionError);
    await expect(failure).rejects.toThrow(`You don't have permission to edit the ${field} in this channel.`);
  });

  test.each(fields)('describes set, replace and clear for %s in the feed', field => {
    const before = JSON.stringify({ ...kept, [field]: 'High' });
    const after = JSON.stringify({ ...kept, [field]: 'Low' });
    expect(describeAppDataChange(JSON.stringify(kept), before)).toBe(`set ${field} "High"`);
    expect(describeAppDataChange(before, after)).toBe(`changed ${field} to "Low"`);
    expect(describeAppDataChange(after, JSON.stringify(kept))).toBe(`removed ${field} "Low"`);
  });
});
