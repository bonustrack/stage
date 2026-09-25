import { describe, expect, test } from 'bun:test';
import {
  GROUP_DESCRIPTION_MAX, GROUP_NAME_MAX, groupChanges, groupDraftFrom, groupDraftProblem, groupMetaCachePatch,
} from '../components/group/EditGroupModal.model';

describe('group edit model', () => {
  test('starts from the current group and reports only what changed', () => {
    const current = { name: 'Crew', description: 'Builders' };
    const draft = groupDraftFrom(current);
    expect(draft).toEqual({ name: 'Crew', description: 'Builders' });
    expect(groupDraftFrom({ name: null, description: '' })).toEqual({ name: '', description: '' });
    expect(groupChanges(current, draft)).toEqual({});
    expect(groupChanges(current, { name: ' Crew ', description: 'Builders  ' })).toEqual({});
    expect(groupChanges({ name: ' Crew ', description: ' Builders ' }, { name: ' Crew ', description: ' Builders ' })).toEqual({});
    expect(groupChanges({ name: null, description: '' }, { name: '', description: '' })).toEqual({});
    expect(groupChanges(current, { ...draft, description: ' Ogres ' })).toEqual({ description: 'Ogres' });
    expect(groupChanges({ name: null, description: '' }, { name: 'Crew', description: '' })).toEqual({ name: 'Crew' });
  });

  test('clearing the description is a change', () => {
    expect(groupChanges({ name: 'Crew', description: 'Old' }, { name: 'Crew', description: '' })).toEqual({ description: '' });
  });

  test('limits lengths, forbids multi-line names and keeps a named group named', () => {
    const named = { name: 'Crew', description: '' };
    expect(groupDraftProblem(named, { name: 'a'.repeat(GROUP_NAME_MAX + 1), description: '' })).toContain(String(GROUP_NAME_MAX));
    expect(groupDraftProblem(named, { name: 'a'.repeat(GROUP_NAME_MAX), description: '' })).toBeNull();
    expect(groupDraftProblem(named, { name: 'ok', description: 'b'.repeat(GROUP_DESCRIPTION_MAX + 1) })).toContain(String(GROUP_DESCRIPTION_MAX));
    expect(groupDraftProblem(named, { name: 'two\nlines', description: '' })).toContain('lines');
    expect(groupDraftProblem(named, { name: '  ', description: '' })).toContain('name');
    expect(groupDraftProblem({ name: null, description: '' }, { name: '', description: 'About' })).toBeNull();
  });

  test('maps a written patch onto the cached conversation meta', () => {
    expect(groupMetaCachePatch({ name: 'Crew', imageUrl: '', description: 'x' }))
      .toEqual({ groupName: 'Crew', groupImage: '', groupDescription: 'x' });
    expect(groupMetaCachePatch({ description: '' })).toEqual({ groupDescription: '' });
  });
});
