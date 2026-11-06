import { describe, expect, test } from 'bun:test';
import { changedFields, draftFrom, hasChanges } from '../components/profile/editProfile.model';

describe('profile edit model', () => {
  test('starts from the current records and reports only what changed', () => {
    const current = { displayName: 'Tony', description: 'Builder' };
    const draft = draftFrom(current);
    expect(draft).toEqual({ displayName: 'Tony', description: 'Builder' });
    expect(changedFields(current, draft)).toEqual({});
    expect(changedFields(current, { ...draft, description: ' Ogre ' })).toEqual({ description: 'Ogre' });
    expect(changedFields({}, { displayName: 'Tony', description: '' })).toEqual({ displayName: 'Tony' });
  });

  test('clearing a record counts as a change so it can be erased onchain', () => {
    expect(changedFields({ description: 'Old' }, { displayName: '', description: '' })).toEqual({ description: '' });
  });

  test('a picked image alone enables saving', () => {
    const current = { displayName: 'Tony' };
    expect(hasChanges(current, draftFrom(current), false)).toBe(false);
    expect(hasChanges(current, draftFrom(current), true)).toBe(true);
  });
});
