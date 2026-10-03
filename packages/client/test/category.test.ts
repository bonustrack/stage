import { describe, expect, test } from 'bun:test';
import { categoryOf, groupTagsOf, LabelPermissionError, writeCategory, writeLabels, type Group } from '../src/xmtp/labels';
import { describeAppDataChange } from '../src/xmtp/appDataChange';
import { appDataGroup } from './helpers';

const blob = (value: Record<string, unknown>): string => JSON.stringify({ v: 1, ...value });

describe('channel category', () => {
  test('cleans the stored value and treats anything else as no category', () => {
    expect(categoryOf('  Client   work ')).toBe('Client work');
    expect(categoryOf('x'.repeat(40))).toBe('x'.repeat(24));
    for (const value of [undefined, null, '', '   ', 7, ['Work'], { name: 'Work' }]) expect(categoryOf(value)).toBeNull();
  });

  test('reads labels, category and assignees together, with old channels having none', async () => {
    const bob = '0x1111111111111111111111111111111111111111';
    expect(await groupTagsOf(appDataGroup(blob({ labels: ['Todo'], category: 'Work', assigned: [bob.toUpperCase().replace('0X', '0x')] })).group))
      .toEqual({ labels: ['Todo'], category: 'Work', assigned: [bob] });
    expect(await groupTagsOf({ appData: blob({ category: 'Ops' }), updateAppData: () => Promise.resolve() }))
      .toEqual({ labels: [], category: 'Ops', assigned: [] });
    for (const raw of ['', '{', '[]', blob({ labels: ['Todo'] }), blob({ category: ['Work'] })]) {
      expect((await groupTagsOf(appDataGroup(raw).group)).category).toBeNull();
    }
    expect(await groupTagsOf({})).toEqual({ labels: [], category: null, assigned: [] });
  });

  test('sets, changes and clears one category while keeping the other fields', async () => {
    const state = appDataGroup(blob({ labels: ['Todo'], assigned: [], custom: 7 }));
    expect(await writeCategory(state.group, ' Work ')).toBe('Work');
    expect(JSON.parse(state.raw())).toEqual({ v: 1, labels: ['Todo'], assigned: [], custom: 7, category: 'Work' });
    expect(await writeCategory(state.group, 'Ops')).toBe('Ops');
    expect(JSON.parse(state.raw()).category).toBe('Ops');
    await writeLabels(state.group, labels => [...labels, 'Stage']);
    expect(JSON.parse(state.raw()).category).toBe('Ops');
    expect(await writeCategory(state.group, null)).toBeNull();
    expect(JSON.parse(state.raw())).toEqual({ v: 1, labels: ['Todo', 'Stage'], assigned: [], custom: 7 });
    expect(await writeCategory(state.group, '   ')).toBeNull();
  });

  test('turns a permission failure into a readable error', async () => {
    const group: Group = { appData: '', updateAppData: () => Promise.reject(new Error('not authorized')) };
    const failure = writeCategory(group, 'Work');
    await expect(failure).rejects.toBeInstanceOf(LabelPermissionError);
    await expect(failure).rejects.toThrow("You don't have permission to edit the category in this channel.");
  });

  test('describes the change in the channel feed', () => {
    expect(describeAppDataChange(blob({}), blob({ category: 'Work' }))).toBe('set category "Work"');
    expect(describeAppDataChange(blob({ category: 'Work' }), blob({ category: 'Ops' }))).toBe('changed category to "Ops"');
    expect(describeAppDataChange(blob({ category: 'Ops' }), blob({ category: null }))).toBe('removed category "Ops"');
    expect(describeAppDataChange(blob({ category: 'Ops' }), blob({}))).toBe('removed category "Ops"');
    expect(describeAppDataChange(blob({ category: 'Ops', labels: [] }), blob({ category: 'Ops', labels: ['Todo'] }))).toBe('added label "Todo"');
  });
});
