import { describe, expect, test } from 'bun:test';
import { createGroupWith } from '@stage-labs/client/xmtp/groups';
import { boardChannelDraft, boardChannelNameProblem } from '../components/board/BoardNewChannel.model';

const self = `0x${'1'.repeat(40)}`;
const assignee = `0x${'ab'.repeat(20)}`;

describe('inline board channel creation', () => {
  test('uses the typed name and exact column metadata, with only self for non-user columns', () => {
    const cases = [
      ['status', 'status:🚧 In progress', '🚧 In progress', { status: '🚧 In progress' }],
      ['category', 'category:stage', 'Stage', { category: 'Stage' }],
      ['label', 'label:UI, Mobile', 'UI, Mobile', { labels: ['UI, Mobile'] }],
    ] as const;
    for (const [by, key, title, fields] of cases) {
      const draft = boardChannelDraft(by, key, title, '  My new channel  ', self);
      expect(draft.name).toBe('My new channel');
      expect(draft.members).toEqual([self]);
      expect(JSON.parse(draft.appData ?? '')).toEqual({ v: 1, ...fields });
    }
  });

  test('user columns invite only their address and assign it, never the display name', () => {
    const draft = boardChannelDraft('assignee', `assignee:0x${assignee.slice(2).toUpperCase()}`, 'Alice', 'Task', self);
    expect(draft.members).toEqual([assignee]);
    expect(JSON.parse(draft.appData ?? '')).toEqual({ v: 1, assigned: [assignee] });
    expect(boardChannelDraft('assignee', `assignee:${self}`, 'Me', 'Task', self).members).toEqual([self]);
  });

  test('unset columns have no inherited project, status, label, assignee or invitations', () => {
    for (const by of ['status', 'category', 'label', 'assignee'] as const) {
      expect(boardChannelDraft(by, `${by}:`, 'No value', 'Task', self)).toEqual({ name: 'Task', members: [self], appData: undefined });
    }
    expect(boardChannelDraft('assignee', 'assignee:Alice', 'Alice', 'Task', self).members).toEqual([self]);
  });

  test('a real column named like an unset column retains its value', () => {
    const draft = boardChannelDraft('category', 'category:no project', 'No project', 'Task', self);
    expect(JSON.parse(draft.appData ?? '')).toEqual({ v: 1, category: 'No project' });
  });

  test('validates names with the existing channel byte limit and reserves private sync names', () => {
    expect(boardChannelNameProblem('   ')).toBe('Enter a channel name.');
    expect(boardChannelNameProblem('  My channel  ')).toBeNull();
    expect(boardChannelNameProblem('a'.repeat(100))).toBeNull();
    expect(boardChannelNameProblem('a'.repeat(101))).toBe('Name is too long.');
    expect(boardChannelNameProblem('😀'.repeat(25))).toBeNull();
    expect(boardChannelNameProblem('😀'.repeat(26))).toBe('Name is too long.');
    expect(boardChannelNameProblem('Two\nlines')).toBe('Name cannot span several lines.');
    expect(boardChannelNameProblem('stage.sync:private')).toBe('Choose another channel name.');
  });

  test('reuses the normal creation validator with a self-only member and one atomic metadata payload', async () => {
    const draft = boardChannelDraft('status', 'status:To-do', 'To-do', 'Task', self);
    const calls: unknown[] = [];
    const created = await createGroupWith(
      draft.members,
      (id) => `test:${id}`,
      async (members) => {
        calls.push({ members, name: draft.name, appData: draft.appData });
        return { id: 'synthetic' };
      },
      async () => 'synthetic-self-inbox',
    );
    expect(created).toEqual({ line: 'test:synthetic', id: 'synthetic' });
    expect(calls).toEqual([{ members: [self], name: 'Task', appData: '{"v":1,"status":"To-do"}' }]);
  });
});
