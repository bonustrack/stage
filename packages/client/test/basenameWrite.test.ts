import { describe, expect, test } from 'bun:test';
import {
  BASENAME_REVERSE_REGISTRAR, encodeSetPrimaryBasename, encodeSetTextRecords,
} from '../src/identity/basenameWrite';
import { BASENAME_L2_RESOLVER } from '../src/identity/onchainProfile';

describe('basename write calls', () => {
  test('writes one record directly and several through multicall', () => {
    const single = encodeSetTextRecords('shrek.base.eth', { description: 'Ogre' });
    expect(single.to).toBe(BASENAME_L2_RESOLVER);
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

});
