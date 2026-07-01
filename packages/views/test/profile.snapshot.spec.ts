import { describe, test } from 'bun:test';
import { infoRow } from '../src/profile/infoRow';
import { profileActionsRow } from '../src/profile/profileActionsRow';
import { profileAddressRow } from '../src/profile/profileAddressRow';
import { profileHeader } from '../src/profile/profileHeader';
import { snap } from './helpers';

describe('profileHeader', () => {
  test('minimal', () => {
    snap(profileHeader({ name: 'Alice' }));
  });
});

describe('infoRow', () => {
  test('minimal', () => {
    snap(infoRow({ label: 'ENS', value: 'alice.eth' }));
  });

  test('full', () => {
    snap(
      infoRow({
        label: 'Address',
        value: '0xabc0000000000000000000000000000000000001',
        copyType: 'custom.copy',
        payload: { kind: 'address' },
      }),
    );
  });
});

describe('profileActionsRow', () => {
  test('minimal', () => {
    snap(
      profileActionsRow({
        actions: [{ action: 'message', icon: 'chat', label: 'Message' }],
        border: '#dddddd',
        fg: '#111111',
      }),
    );
  });

  test('full', () => {
    snap(
      profileActionsRow({
        actions: [
          { action: 'message', icon: 'chat', label: 'Message' },
          { action: 'pay', icon: 'banknotes', label: 'Pay', disabled: true },
        ],
        border: '#dddddd',
        fg: '#111111',
        pressType: 'custom.round',
      }),
    );
  });
});

describe('profileAddressRow', () => {
  test('minimal', () => {
    snap(
      profileAddressRow({
        address: '0xabc0000000000000000000000000000000000001',
        label: '0xabc0…0001',
        color: '#666666',
      }),
    );
  });

  test('full', () => {
    snap(
      profileAddressRow({
        address: '0xabc0000000000000000000000000000000000001',
        label: '0xabc0…0001',
        color: '#666666',
        pressType: 'custom.copy',
      }),
    );
  });
});
