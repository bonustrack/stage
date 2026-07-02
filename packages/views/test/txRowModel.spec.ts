import { describe, expect, test } from 'bun:test';
import { txRowModel } from '../src/activity/txRowModel';

const base = {
  direction: 'receive' as const,
  title: 'Received',
  partyLabel: 'From alice.eth',
  timeLabel: '5m',
  valueEth: '0.25',
  chainLabel: 'Ethereum',
  nonce: 7,
  failed: false,
};

describe('txRowModel', () => {
  test('web shape keeps party and time separate', () => {
    expect(txRowModel(base)).toEqual({
      direction: 'in',
      title: 'Received',
      amount: '0.25',
      token: 'ETH',
      timestamp: '5m',
      counterparty: 'From alice.eth',
      chainLabel: 'Ethereum',
      subText: '#7',
      failed: false,
    });
  });

  test('metaTime combines party and time for the mobile meta line', () => {
    const p = txRowModel(base, { metaTime: true });
    expect(p.counterparty).toBe('From alice.eth · 5m');
    expect(p.timestamp).toBe('From alice.eth · 5m');
  });

  test('directions map to tx row directions and failures set subText', () => {
    expect(txRowModel({ ...base, direction: 'send' }).direction).toBe('out');
    expect(txRowModel({ ...base, direction: 'self' }).direction).toBe('self');
    expect(txRowModel({ ...base, failed: true }).subText).toBe('Failed');
    expect(txRowModel({ ...base, failed: true }).failed).toBe(true);
  });
});
