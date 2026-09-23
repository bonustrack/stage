import { describe, expect, test } from 'bun:test';
import {
  networkName, recipientAddress, recipientFor, recipientHint, recipientQuery, recipientSummary,
  settleRecipient, startRecipient, RECIPIENT_HELP,
} from '../components/wallet/recipient.model';

const ALICE = '0xa94Cb9AA3CB82880142ff98706320E1Fb9B31767';
const alice = ALICE.toLowerCase();
const shorten = (a: string): string => `${a.slice(0, 6)}…${a.slice(-4)}`;

describe('recipientQuery', () => {
  test('stage usernames in every spelling resolve through the full onchain name', () => {
    for (const input of ['alice321', '@alice321', 'alice321.stage.base.eth', '  @Alice321 ']) {
      expect(recipientQuery(input)).toEqual({ handle: 'alice321.stage.base.eth', label: '@alice321' });
    }
  });

  test('addresses, basenames and ens names', () => {
    expect(recipientQuery(ALICE)).toEqual({ handle: alice, label: null });
    expect(recipientQuery('less.base.eth')).toEqual({ handle: 'less.base.eth', label: 'less.base.eth' });
    expect(recipientQuery('vitalik.eth')).toEqual({ handle: 'vitalik.eth', label: 'vitalik.eth' });
  });

  test('rejects short labels and junk', () => {
    expect(recipientQuery('bob')).toBeNull();
    expect(recipientQuery('0x12')).toBeNull();
    expect(recipientQuery('not a name')).toBeNull();
  });
});

describe('recipient states', () => {
  test('empty and invalid inputs have no address', () => {
    expect(startRecipient('  ')).toEqual({ kind: 'empty', input: '  ' });
    const invalid = startRecipient('bob');
    expect(invalid.kind).toBe('invalid');
    expect(recipientAddress(invalid)).toBeNull();
    expect(recipientHint(invalid)).toEqual({ text: RECIPIENT_HELP, tone: 'secondary' });
  });

  test('a raw address resolves immediately without a label', () => {
    const state = startRecipient(ALICE);
    expect(state).toEqual({ kind: 'resolved', input: ALICE, address: alice, label: null });
    expect(recipientHint(state)).toBeUndefined();
    expect(recipientSummary(state, shorten)).toEqual({ title: '0xa94c…1767', label: null, address: alice });
  });

  test('a username resolves through a spinner state to the address with its handle', () => {
    const resolving = startRecipient('@alice321');
    expect(resolving.kind).toBe('resolving');
    expect(recipientAddress(resolving)).toBeNull();
    expect(recipientHint(resolving)).toEqual({ text: 'Looking up @alice321…', tone: 'secondary' });
    const resolved = settleRecipient(resolving, ALICE);
    expect(resolved).toEqual({ kind: 'resolved', input: '@alice321', address: alice, label: '@alice321' });
    expect(recipientAddress(resolved)).toBe(alice);
    expect(recipientSummary(resolved, shorten)).toEqual({ title: '@alice321', label: '@alice321', address: alice });
  });

  test('an unknown username shows a clear error', () => {
    const unresolved = settleRecipient(startRecipient('nobody999'), null);
    expect(unresolved).toEqual({ kind: 'unresolved', input: 'nobody999', label: '@nobody999' });
    expect(recipientHint(unresolved)).toEqual({ text: 'No address found for @nobody999', tone: 'danger' });
    expect(recipientSummary(unresolved, shorten)).toBeNull();
  });

  test('basenames resolve on Base, mainnet ENS names are refused without a lookup', () => {
    expect(startRecipient('less.base.eth').kind).toBe('resolving');
    const ens = startRecipient('vitalik.eth');
    expect(ens).toEqual({ kind: 'unsupported', input: 'vitalik.eth', label: 'vitalik.eth' });
    expect(recipientAddress(ens)).toBeNull();
    expect(recipientHint(ens)).toEqual({ text: 'vitalik.eth is a mainnet ENS name. Stage only supports names on Base.', tone: 'danger' });
    expect(settleRecipient(ens, ALICE)).toBe(ens);
  });

  test('settling only applies to a pending lookup', () => {
    const resolved = startRecipient(ALICE);
    expect(settleRecipient(resolved, null)).toBe(resolved);
  });

  test('a stored state for older input never leaks into the current input', () => {
    const stale = settleRecipient(startRecipient('alice321'), ALICE);
    expect(recipientFor(stale, 'alice321')).toBe(stale);
    const fresh = recipientFor(stale, 'alice3210');
    expect(fresh.kind).toBe('resolving');
    expect(recipientAddress(fresh)).toBeNull();
  });
});

describe('networkName', () => {
  test('names the send networks', () => {
    expect(networkName(8453)).toBe('Base');
    expect(networkName(1)).toBe('Ethereum');
    expect(networkName(10)).toBe('Chain 10');
  });
});
