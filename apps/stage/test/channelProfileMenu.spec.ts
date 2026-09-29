import { describe, expect, test } from 'bun:test';
import { channelProfileMenuItems } from '../components/channel/channel.parts.model';

describe('channelProfileMenuItems', () => {
  test('members who can edit get Edit channel before Leave channel', () => {
    expect(channelProfileMenuItems(true).map(item => item.id)).toEqual(['edit', 'leave']);
  });

  test('members who cannot edit only get Leave channel', () => {
    expect(channelProfileMenuItems(false).map(item => item.id)).toEqual(['leave']);
  });

  test('leaving is the danger action', () => {
    expect(channelProfileMenuItems(true).filter(item => item.danger === true).map(item => item.id)).toEqual(['leave']);
  });
});
