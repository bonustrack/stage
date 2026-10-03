import { describe, expect, test } from 'bun:test';
import { decodeFunctionData, namehash, parseAbi, type Hex } from 'viem';
import {
  BASENAME_REVERSE_REGISTRAR, encodeNameSetup, encodeSetPrimaryBasename, encodeSetTextRecords,
} from '../src/identity/basenameWrite';
import { BASENAME_L2_RESOLVER } from '../src/identity/onchainProfile';

const RESOLVER = parseAbi([
  'function setAddr(bytes32 node, address a)', 'function setText(bytes32 node, string key, string value)',
  'function multicall(bytes[] data) returns (bytes[])', 'function setName(string name) returns (bytes32)',
]);
const USER: Hex = '0x00000000000000000000000000000000000000A1';
const STAGE_RESOLVER: Hex = '0x426fA03fB86E510d0Dd9F70335Cf102a98b10875';

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

  test('a new name is set up by one resolver call, address first, then the primary name', () => {
    const node = namehash('fabien.stage.base.eth');
    const [records, primary, ...rest] = encodeNameSetup('fabien.stage.base.eth', USER, { name: 'Fabien', avatar: 'ipfs://cid' }, STAGE_RESOLVER);
    expect(rest).toEqual([]);
    expect(records?.to).toBe(STAGE_RESOLVER);
    const outer = decodeFunctionData({ abi: RESOLVER, data: records?.data ?? '0x' });
    expect(outer.functionName).toBe('multicall');
    const inner = (outer.args[0] as Hex[]).map((data) => decodeFunctionData({ abi: RESOLVER, data }));
    expect(inner.map((call) => [call.functionName, ...call.args])).toEqual([
      ['setAddr', node, USER], ['setText', node, 'name', 'Fabien'], ['setText', node, 'avatar', 'ipfs://cid'],
    ]);
    expect(primary).toEqual(encodeSetPrimaryBasename('fabien.stage.base.eth'));
  });

  test('without profile records the resolver call is setAddr alone', () => {
    const [records, primary] = encodeNameSetup('fabien.stage.base.eth', USER, {}, STAGE_RESOLVER);
    const call = decodeFunctionData({ abi: RESOLVER, data: records?.data ?? '0x' });
    expect([call.functionName, ...call.args]).toEqual(['setAddr', namehash('fabien.stage.base.eth'), USER]);
    expect(primary?.to).toBe(BASENAME_REVERSE_REGISTRAR);
  });

});
