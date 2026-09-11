import { describe, expect, test } from 'bun:test';
import { profileView } from '../components/settings/ProfileSettings.model';

const ADDR = '0x00000000000000000000000000000000000000A1';

describe('profileView', () => {
  test('a Basename can change its picture and be managed on base.org', () => {
    const view = profileView({ address: ADDR, name: 'shrek.base.eth', source: 'basename' });
    expect(view.canChangePicture).toBe(true);
    expect(view.manageLabel).toBe('Manage on base.org');
    expect(view.claimVisible).toBe(false);
  });

  test('without an onchain name the claim action is offered', () => {
    const view = profileView({ address: ADDR, name: 'Tony' });
    expect(view.claimVisible).toBe(true);
    expect(view.canChangePicture).toBe(false);
    expect(view.title).toBe('Tony');
  });
});
