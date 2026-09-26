import { describe, expect, test } from 'bun:test';
import {
  labelIndex, mergeLabelEntries, renamedLabelEntries, resolveLabel, withLabelNames, type LabelEntry,
} from '../src/xmtp/labelRegistry';
import { renameLabels } from '../src/xmtp/labels';

const entry = (id: string, name: string, aliases: string[] = [], at = 0): LabelEntry => ({ id, name, aliases, at });

describe('label ids', () => {
  test('a name or an old name resolves to its entry whatever the case', () => {
    const entries = [entry('todo', 'Doing', ['Todo'], 5), entry('done', 'Done')];
    expect(resolveLabel(entries, 'doing').id).toBe('todo');
    expect(resolveLabel(entries, ' TODO ').id).toBe('todo');
    expect(resolveLabel(entries, 'Done').id).toBe('done');
  });

  test('an unknown name gets its lowercased name as id, suffixed when that id is taken', () => {
    expect(resolveLabel([], ' Blocked  now ')).toEqual(entry('blocked now', 'Blocked now'));
    expect(resolveLabel([entry('todo', 'Doing')], 'Todo').id).toBe('todo~2');
  });

  test('a current name wins over another entry keeping it as an old name', () => {
    const index = labelIndex([entry('a', 'Todo'), entry('b', 'Doing', ['Todo'])]);
    expect(index.get('todo')?.id).toBe('a');
  });

  test('new names are added once and nothing changes when all are known', () => {
    const entries = [entry('todo', 'Todo')];
    expect(withLabelNames(entries, ['todo', 'Todo'])).toBe(entries);
    expect(withLabelNames(entries, ['Done', 'done', '  ']).map(e => e.id)).toEqual(['done', 'todo']);
  });
});

describe('renaming', () => {
  test('keeps the id and remembers the old name', () => {
    const next = renamedLabelEntries([entry('todo', 'Todo'), entry('done', 'Done')], entry('todo', 'Todo'), ' Doing ', 7);
    expect(next).toEqual([entry('done', 'Done'), entry('todo', 'Doing', ['Todo'], 7)]);
  });

  test('renaming back drops the name from the old names', () => {
    const once = renamedLabelEntries([entry('todo', 'Todo')], entry('todo', 'Todo'), 'Doing', 1);
    expect(renamedLabelEntries(once, entry('todo', 'Todo'), 'todo', 2)).toEqual([entry('todo', 'todo', ['Doing'], 2)]);
  });
});

describe('merging label lists from other devices', () => {
  test('the newer rename wins and old names are kept from both sides', () => {
    const phone = [entry('todo', 'Doing', ['Todo'], 5)];
    const laptop = [entry('todo', 'Next', ['Todo', 'Later'], 9)];
    expect(mergeLabelEntries(phone, laptop)).toEqual([entry('todo', 'Next', ['Todo', 'Doing', 'Later'], 9)]);
    expect(mergeLabelEntries(laptop, phone)).toEqual(mergeLabelEntries(phone, laptop));
  });

  test('a label seen under its new name on another device joins the renamed entry', () => {
    const renamed = [entry('todo', 'Doing', ['Todo'], 5)];
    const fresh = [entry('doing', 'Doing')];
    expect(mergeLabelEntries(fresh, renamed)).toEqual([entry('todo', 'Doing', ['Todo'], 5)]);
  });

  test('an old name that is now another entry\'s name is no longer an old name', () => {
    const merged = mergeLabelEntries([entry('todo', 'Doing', ['Todo'], 5)], [entry('todo~2', 'Todo')]);
    expect(merged).toEqual([entry('todo', 'Doing', [], 5), entry('todo~2', 'Todo')]);
  });
});

describe('renaming a label inside a group', () => {
  test('replaces the first matching name in place and drops other spellings', () => {
    expect(renameLabels(['Urgent', 'todo', 'Done'], ['Todo'], 'Doing')).toEqual(['Urgent', 'Doing', 'Done']);
    expect(renameLabels(['Later', 'Urgent', 'Todo'], ['Todo', 'Later'], 'Doing')).toEqual(['Doing', 'Urgent']);
    expect(renameLabels(['Urgent', 'Doing', 'Todo'], ['Todo'], 'Doing')).toEqual(['Urgent', 'Doing']);
  });

  test('leaves the labels alone when the group has none of the names or the new name is empty', () => {
    const labels = ['Urgent'];
    expect(renameLabels(labels, ['Todo'], 'Doing')).toBe(labels);
    expect(renameLabels(['Todo'], ['Todo'], '   ')).toEqual(['Todo']);
  });
});
