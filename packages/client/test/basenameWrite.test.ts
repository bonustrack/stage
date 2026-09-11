import { describe, expect, test } from 'bun:test';
import {
  BASENAME_REVERSE_REGISTRAR, encodeSetBasenameAvatar, encodeSetPrimaryBasename, encodeSetTextRecords, manageBasenameUrl,
} from '../src/identity/basenameWrite';
import { BASENAME_L2_RESOLVER } from '../src/identity/onchainProfile';

describe('basename write calls', () => {
  test('sets the avatar text record on the L2 resolver', () => {
    const call = encodeSetBasenameAvatar('shrek.base.eth', 'ipfs://bafy');
    expect(call.to).toBe(BASENAME_L2_RESOLVER);
    expect(call.data.startsWith('0x10f13a8c')).toBe(true);
  });

  test('writes one record directly and several through multicall', () => {
    const single = encodeSetTextRecords('shrek.base.eth', { description: 'Ogre' });
    expect(single.data.startsWith('0x10f13a8c')).toBe(true);
    const many = encodeSetTextRecords('shrek.base.eth', { name: 'Shrek', description: 'Ogre' }, '0x00000000000000000000000000000000000000C0');
    expect(many.to).toBe('0x00000000000000000000000000000000000000C0');
    expect(many.data.startsWith('0xac9650d8')).toBe(true);
  });

  test('sets the primary name on the reverse registrar', () => {
    const call = encodeSetPrimaryBasename('shrek.base.eth');
    expect(call.to).toBe(BASENAME_REVERSE_REGISTRAR);
    expect(call.data.startsWith('0xc47f0027')).toBe(true);
  });

  test('links to the base.org manager for basenames but not for stage subnames', () => {
    expect(manageBasenameUrl('shrek.base.eth')).toBe('https://www.base.org/name/shrek');
    expect(manageBasenameUrl('fabien.stage.base.eth')).toBeNull();
  });
});
