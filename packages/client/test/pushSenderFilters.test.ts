import { describe, expect, test } from 'bun:test';
import { ed25519ph } from '@noble/curves/ed25519';
import { privateKeyToAccount } from 'viem/accounts';
import {
  derivePushGroupKey, deriveSenderFilterGroupKey, senderFilterSignatureText, senderFilterTopics, signedSenderFilters,
} from '../src/xmtp/pushServer';

const TOPIC = '/xmtp/mls/1/g-0123456789abcdef0123456789abcdef/proto';
const OWNER = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');

describe('authenticated account-wide sender filters', () => {
  test('normalizes numeric-array signatures returned by the native SDK bridge', async () => {
    const body = await signedSenderFilters('ab', 'cd', [], 100, async () => [1, 2, 3]);
    expect(body.signature).toBe('AQID');
  });

  test('capabilities are stable, account/inbox specific and separated from legacy groups', async () => {
    const sign = (message: string) => OWNER.signMessage({ message });
    const key = await deriveSenderFilterGroupKey('0xAb', 'Cd', sign);
    expect(await deriveSenderFilterGroupKey('0xab', 'cd', sign)).toBe(key);
    expect(await deriveSenderFilterGroupKey('0xac', 'cd', sign)).not.toBe(key);
    expect(await deriveSenderFilterGroupKey('0xab', 'ce', sign)).not.toBe(key);
    expect(await derivePushGroupKey('0xab', sign)).not.toBe(key);
  });

  test('canonicalizes only topics with keys and never includes welcome topics', () => {
    const a = { thirtyDayPeriodsSinceEpoch: 700, hmacKey: new Uint8Array([1]) };
    const b = { thirtyDayPeriodsSinceEpoch: 699, hmacKey: new Uint8Array([2]) };
    expect(senderFilterTopics([TOPIC, TOPIC, '/xmtp/mls/1/w-ab/proto', '/xmtp/mls/1/g-cd/proto'], {
      [TOPIC]: [a, b], '/xmtp/mls/1/w-ab/proto': [a],
    })).toEqual([{ topic: TOPIC, hmacKeys: [
      { thirtyDayPeriodsSinceEpoch: 699, key: 'Ag==' }, { thirtyDayPeriodsSinceEpoch: 700, key: 'AQ==' },
    ] }]);
  });

  test('signs every accepted field, and drops content and token properties', async () => {
    const values = [{ topic: TOPIC, message: 'private', token: 'private', hmacKeys: [
      { thirtyDayPeriodsSinceEpoch: 700, key: 'AQ==', plaintext: 'private' },
    ] }];
    const signed: string[] = [];
    const body = await signedSenderFilters('AB', 'cd', values, 100, async text => {
      signed.push(text);
      return new Uint8Array([1]);
    });
    expect(body.payload).toBe(JSON.stringify({ installationId: 'ab', groupKey: 'cd', issuedAt: 100, topics: [
      { topic: TOPIC, hmacKeys: [{ thirtyDayPeriodsSinceEpoch: 700, key: 'AQ==' }] },
    ] }));
    expect(body.signature).toBe('AQ==');
    expect(signed).toEqual([senderFilterSignatureText(body.payload)]);
    for (const modified of ['ab', 'cd', '100', '700', 'AQ==', TOPIC]) {
      expect(senderFilterSignatureText(body.payload.replace(modified, 'changed'))).not.toBe(signed[0]);
    }
  });

  test('matches the Go fixture verified by the pinned XMTP WASM implementation', async () => {
    const seed = new Uint8Array(32);
    const context = new TextEncoder().encode('PUBLIC SIGNATURE CONTEXT');
    const body = await signedSenderFilters(Buffer.from(ed25519ph.getPublicKey(seed)).toString('hex'), 'b'.repeat(64), [
      { topic: TOPIC, hmacKeys: [{ thirtyDayPeriodsSinceEpoch: 694, key: Buffer.from(new Uint8Array(42).fill(1)).toString('base64') }] },
    ], 1_800_000_000, async text => ed25519ph.sign(new TextEncoder().encode(text), seed, { context }));
    const fixture: unknown = await Bun.file(new URL('../../../apps/push/stagepush/testdata/sender-filter.json', import.meta.url)).json();
    expect(body).toEqual(fixture);
  });
});
