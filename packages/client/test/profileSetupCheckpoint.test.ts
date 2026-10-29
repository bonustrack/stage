import { describe, expect, test } from 'bun:test';
import { parsePendingSetup, samePreparedAccount } from '../src/profile/setup';

const account = {
  id: '0x00000000000000000000000000000000000000a1',
  address: '0x00000000000000000000000000000000000000a1',
  type: 'smart',
  dbDir: 'xmtp-0x00000000000000000000000000000000000000a1',
  createdAt: 1,
  hdIndex: 0,
  phraseId: 'synthetic-reference',
  ownerAddress: '0x00000000000000000000000000000000000000a2',
};
const profile = { label: 'synthetic123', image: { uri: 'data:image/png;base64,c3ludGhldGlj', mime: 'image/png' } };
const checkpoint = { version: 1, stage: 'profile', account, profile };
const parse = (value: unknown) => parsePendingSetup(JSON.stringify(value));

describe('public setup checkpoint boundary', () => {
  test('accepts a prepared account and durable image without any key material', () => {
    expect(parse(checkpoint)).toEqual(checkpoint);
  });
  for (const patch of [
    { account: undefined },
    { account: { ...account, dbDir: '../other-account' } },
    { account: { ...account, address: account.ownerAddress } },
    { account: { ...account, privateKey: 'synthetic-secret' } },
    { mnemonic: 'synthetic-secret' },
    { profile: { ...profile, image: { ...profile.image, uri: 'file:///private/app-data' } } },
    { profile: { ...profile, image: { ...profile.image, uri: 'blob:expired' } } },
    { progress: { transactions: ['invalid'] } },
  ]) {
    test(`rejects inconsistent or nonpublic checkpoint ${JSON.stringify(patch)}`, () => {
      expect(() => parse({ ...checkpoint, ...patch })).toThrow();
    });
  }
  test('resumed account metadata must match the whole public identity and storage tuple', () => {
    const prepared = parse(checkpoint).account;
    if (prepared === undefined) throw new Error('Missing synthetic prepared account');
    expect(samePreparedAccount(prepared, { ...prepared, registered: true })).toBe(true);
    for (const patch of [
      { address: prepared.ownerAddress },
      { dbDir: 'other-account' },
      { hdIndex: 1 },
      { phraseId: 'other-phrase' },
      { ownerAddress: prepared.address },
    ]) {
      expect(samePreparedAccount(prepared, { ...prepared, ...patch })).toBe(false);
    }
  });
  test('rejects unbound progress and corrupt JSON instead of starting fresh', () => {
    expect(() => parse({ version: 1, stage: 'wallet', profile, progress: { submitting: true } })).toThrow();
    expect(() => parsePendingSetup('{')).toThrow();
  });
});
