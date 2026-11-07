import { describe, expect, test } from 'bun:test';
import { createGroupWith } from '@stage-labs/client/xmtp/groups';
import {
  boardChannelCreations,
  boardChannelDraft,
  boardChannelNameProblem,
  boardChannelRows,
  type BoardChannelCreations,
  type BoardPendingChannel,
} from '../components/home/board/BoardNewChannel.model';

const self = `0x${'1'.repeat(40)}`;
const assignee = `0x${'ab'.repeat(20)}`;

function pendingChannel(id: number, name = 'Task', appData?: string): BoardPendingChannel {
  return { id, name, members: [self], appData, existingIds: new Set(['existing']), convId: null, error: null };
}

function creationState(...pending: BoardPendingChannel[]): BoardChannelCreations {
  return { pending, createdIds: new Set() };
}

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

  test('shows the pending card instead of an early matching stream row, without hiding existing same-name cards', () => {
    const base = { groupName: 'Task', peerAddress: null, priority: null, category: null, status: 'To-do', labels: [], assigned: [] };
    const rows = [
      { ...base, convId: 'existing' },
      { ...base, convId: 'early' },
      { ...base, convId: 'other-title', groupName: 'Other task' },
      { ...base, convId: 'other-status', status: 'Done' },
      { ...base, convId: 'other-project', category: 'Stage' },
      { ...base, convId: 'other-label', labels: ['Bug'] },
      { ...base, convId: 'other-assignee', assigned: [assignee] },
      { ...base, convId: 'other-priority', priority: 'High' },
      { ...base, convId: 'dm', peerAddress: assignee },
    ];
    const pending = pendingChannel(1, 'Task', '{"v":1,"status":"To-do"}');
    expect(boardChannelRows(rows, creationState(pending))).toEqual(rows.filter((row) => row.convId !== 'early'));
    expect(boardChannelRows(rows, creationState())).toBe(rows);
    expect(rows).toHaveLength(9);
  });

  test('uses only the returned conversation ID after creation settles and restores other matching arrivals', () => {
    const rows = ['existing', 'early', 'concurrent'].map((convId) => ({
      convId,
      groupName: 'Task',
      peerAddress: null,
      priority: null,
      category: null,
      status: null,
      labels: [],
      assigned: [],
    }));
    const state = creationState(pendingChannel(1));
    expect(boardChannelRows(rows, state).map((row) => row.convId)).toEqual(['existing']);
    const created = boardChannelCreations(state, { type: 'created', id: 1, convId: 'early' });
    expect(boardChannelRows(rows, created)).toEqual(rows);
    expect(boardChannelRows(rows, boardChannelCreations(state, { type: 'created', id: 1, convId: 'not-streamed' }))).toEqual(rows);
    expect(boardChannelRows(rows, creationState())).toBe(rows);
  });

  test('keeps independent submissions and out-of-order results tied to their own names and metadata', () => {
    const first = pendingChannel(1, 'First', '{"v":1,"status":"To-do"}');
    const second = { ...pendingChannel(2, 'Second', '{"v":1,"assigned":["' + assignee + '"]}'), members: [assignee] };
    let state = boardChannelCreations(creationState(), { type: 'submit', pending: first });
    state = boardChannelCreations(state, { type: 'submit', pending: second });
    expect(state.pending).toEqual([second, first]);
    state = boardChannelCreations(state, { type: 'created', id: 2, convId: 'second-id' });
    state = boardChannelCreations(state, { type: 'failed', id: 1, error: 'First failed' });
    expect(state.pending).toEqual([
      { ...second, convId: 'second-id' },
      { ...first, error: 'First failed' },
    ]);
    expect(state.createdIds).toEqual(new Set(['second-id']));
    expect(first.convId).toBeNull();
    expect(second.convId).toBeNull();
  });

  test('retries and dismisses only the selected failed operation, preserving its title and invitations', () => {
    const first = { ...pendingChannel(1), error: 'First failed' };
    const second = pendingChannel(2, 'Another task');
    const failed = creationState(first, second);
    const retried = boardChannelCreations(failed, { type: 'retry', id: 1, existingIds: new Set(['new-existing']) });
    expect(retried.pending).toEqual([{ ...first, error: null, existingIds: new Set(['existing', 'new-existing']) }, second]);
    expect(boardChannelCreations(retried, { type: 'dismiss', id: 1 }).pending).toEqual(retried.pending);
    expect(boardChannelCreations(failed, { type: 'dismiss', id: 1 }).pending).toEqual([second]);
    expect(boardChannelCreations(failed, { type: 'dismiss', id: 2 }).pending).toEqual([first, second]);
    expect(boardChannelCreations(failed, { type: 'retry', id: 2, existingIds: new Set() }).pending).toEqual(failed.pending);
  });

  test('hands off identical concurrent names by exact returned IDs without hiding an already confirmed sibling', () => {
    const rows = ['existing', 'first-id', 'second-id', 'unrelated-match'].map((convId) => ({
      convId,
      groupName: 'Task',
      peerAddress: null,
      priority: null,
      category: null,
      status: null,
      labels: [],
      assigned: [],
    }));
    let state = creationState(pendingChannel(1), pendingChannel(2));
    expect(boardChannelRows(rows, state).map((row) => row.convId)).toEqual(['existing']);
    state = boardChannelCreations(state, { type: 'created', id: 2, convId: 'second-id' });
    expect(boardChannelRows(rows, state).map((row) => row.convId)).toEqual(['existing', 'second-id']);
    state = boardChannelCreations(state, { type: 'confirm', ids: new Set(['second-id']) });
    expect(state.pending.map((p) => p.id)).toEqual([1]);
    expect(boardChannelRows(rows, state).map((row) => row.convId)).toEqual(['existing', 'second-id']);
    state = boardChannelCreations(state, { type: 'created', id: 1, convId: 'first-id' });
    expect(boardChannelRows(rows, state)).toEqual(rows);
    state = boardChannelCreations(state, { type: 'confirm', ids: new Set(['first-id']) });
    expect(state.pending).toEqual([]);
    expect(state.createdIds).toEqual(new Set(['second-id', 'first-id']));
    expect(boardChannelRows(rows, state)).toBe(rows);
  });

  test('a failed operation releases uncertain stream candidates without losing a successful sibling', () => {
    const rows = ['existing', 'second-id', 'candidate'].map((convId) => ({
      convId,
      groupName: 'Task',
      peerAddress: null,
      priority: null,
      category: null,
      status: null,
      labels: [],
      assigned: [],
    }));
    let state = boardChannelCreations(creationState(pendingChannel(1), pendingChannel(2)), { type: 'created', id: 2, convId: 'second-id' });
    state = boardChannelCreations(state, { type: 'failed', id: 1, error: 'Failed' });
    expect(boardChannelRows(rows, state)).toEqual(rows);
    expect(state.pending.find((p) => p.id === 2)?.convId).toBe('second-id');
    const unchanged = boardChannelCreations(state, { type: 'confirm', ids: new Set(['not-present']) });
    expect(unchanged).toBe(state);
  });

  test('a later identical submission preserves returned IDs even while their stream rows are absent', () => {
    const row = {
      convId: 'first-id',
      groupName: 'Task',
      peerAddress: null,
      priority: null,
      category: null,
      status: null,
      labels: [],
      assigned: [],
    };
    let state = boardChannelCreations(creationState(pendingChannel(1)), { type: 'created', id: 1, convId: row.convId });
    state = boardChannelCreations(state, { type: 'confirm', ids: new Set([row.convId]) });
    state = boardChannelCreations(state, { type: 'submit', pending: pendingChannel(2) });
    expect(boardChannelRows([row], state)).toEqual([row]);
    expect(state.pending.map((p) => p.id)).toEqual([2]);
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
