import { describe, expect, test } from 'bun:test';
import {
  CHANNEL_DESCRIPTION_MAX, CHANNEL_NAME_MAX, channelChanges, channelDraftFrom, channelDraftProblem,
} from '../components/channel/EditChannelModal.model';

describe('channel edit model', () => {
  test('starts from the current channel and reports only what changed', () => {
    const current = { name: 'Crew', description: 'Builders' };
    const draft = channelDraftFrom(current);
    expect(draft).toEqual({ name: 'Crew', description: 'Builders' });
    expect(channelDraftFrom({ name: null, description: '' })).toEqual({ name: '', description: '' });
    expect(channelChanges(current, draft)).toEqual({});
    expect(channelChanges(current, { name: ' Crew ', description: 'Builders  ' })).toEqual({});
    expect(channelChanges({ name: ' Crew ', description: ' Builders ' }, { name: ' Crew ', description: ' Builders ' })).toEqual({});
    expect(channelChanges({ name: null, description: '' }, { name: '', description: '' })).toEqual({});
    expect(channelChanges(current, { ...draft, description: ' Ogres ' })).toEqual({ description: 'Ogres' });
    expect(channelChanges({ name: null, description: '' }, { name: 'Crew', description: '' })).toEqual({ name: 'Crew' });
  });

  test('clearing the description is a change', () => {
    expect(channelChanges({ name: 'Crew', description: 'Old' }, { name: 'Crew', description: '' })).toEqual({ description: '' });
  });

  test('limits lengths in bytes, forbids multi-line names and keeps a named channel named', () => {
    const named = { name: 'Crew', description: '' };
    expect(channelDraftProblem(named, { name: 'a'.repeat(CHANNEL_NAME_MAX + 1), description: '' })).toBe('Name is too long.');
    expect(channelDraftProblem(named, { name: 'a'.repeat(CHANNEL_NAME_MAX), description: '' })).toBeNull();
    expect(channelDraftProblem(named, { name: `  ${'a'.repeat(CHANNEL_NAME_MAX)}  `, description: '' })).toBeNull();
    expect(channelDraftProblem(named, { name: 'Ж'.repeat(CHANNEL_NAME_MAX / 2 + 1), description: '' })).toBe('Name is too long.');
    expect(channelDraftProblem(named, { name: 'Ж'.repeat(CHANNEL_NAME_MAX / 2), description: '' })).toBeNull();
    expect(channelDraftProblem(named, { name: 'Crew', description: 'b'.repeat(CHANNEL_DESCRIPTION_MAX + 1) })).toBe('Description is too long.');
    expect(channelDraftProblem(named, { name: 'Crew', description: 'b'.repeat(CHANNEL_DESCRIPTION_MAX) })).toBeNull();
    expect(channelDraftProblem(named, { name: 'Crew', description: ` ${'b'.repeat(CHANNEL_DESCRIPTION_MAX)} ` })).toBeNull();
    expect(channelDraftProblem(named, { name: 'Crew', description: 'Ж'.repeat(CHANNEL_DESCRIPTION_MAX / 2 + 1) })).toBe('Description is too long.');
    expect(channelDraftProblem(named, { name: 'two\nlines', description: '' })).toBe('Name cannot span several lines.');
    expect(channelDraftProblem(named, { name: 'two\rlines', description: '' })).toBe('Name cannot span several lines.');
    expect(channelDraftProblem(named, { name: '  ', description: '' })).toBe('A channel needs a name.');
    expect(channelDraftProblem({ name: null, description: '' }, { name: '', description: 'About' })).toBeNull();
  });

  test('only the fields being changed are checked', () => {
    const odd = { name: 'Team\nAlpha', description: 'd'.repeat(CHANNEL_DESCRIPTION_MAX + 1) };
    expect(channelDraftProblem(odd, { name: odd.name, description: 'New words' })).toBeNull();
    expect(channelDraftProblem(odd, { name: 'Team', description: odd.description })).toBeNull();
    expect(channelDraftProblem(odd, { name: 'Team\nBeta', description: odd.description })).toBe('Name cannot span several lines.');
  });
});
