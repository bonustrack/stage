import { describe, test } from 'bun:test';
import { txRow } from '../src/activity/txRow';
import { snap } from './helpers';

const TX_BASE = {
  title: 'Received',
  amount: '0.5',
  token: 'ETH',
  timestamp: 'Jun 4',
  counterparty: 'vitalik.eth',
};

describe('txRow', () => {
  test('minimal incoming', () => {
    snap(txRow({ ...TX_BASE, direction: 'in' }));
  });

  test('full outgoing failed', () => {
    snap(
      txRow({
        ...TX_BASE,
        direction: 'out',
        title: 'Sent',
        chainLabel: 'Base',
        subText: 'Failed',
        failed: true,
      }),
    );
  });

  test('self transfer', () => {
    snap(txRow({ ...TX_BASE, direction: 'self', title: 'Shielded' }));
  });

  test('zero amount renders a dash', () => {
    snap(txRow({ ...TX_BASE, direction: 'in', amount: '0' }));
  });
});
