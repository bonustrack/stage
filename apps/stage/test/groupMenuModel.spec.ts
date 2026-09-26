import { describe, expect, test } from 'bun:test';
import { groupMenuItems } from '../components/group/group.parts.model';

describe('groupMenuItems', () => {
  test('members who can edit get Edit group before Leave group', () => {
    expect(groupMenuItems(true).map(item => item.id)).toEqual(['edit', 'leave']);
  });

  test('members who cannot edit only get Leave group', () => {
    expect(groupMenuItems(false).map(item => item.id)).toEqual(['leave']);
  });

  test('leaving is the danger action', () => {
    expect(groupMenuItems(true).filter(item => item.danger === true).map(item => item.id)).toEqual(['leave']);
  });
});
