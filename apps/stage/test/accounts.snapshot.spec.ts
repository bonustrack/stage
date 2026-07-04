import { describe, test } from 'bun:test';
import { accountRow } from '../views/accounts/accountRow';
import { memberAddForm } from '../views/accounts/memberAddForm';
import { memberChip } from '../views/accounts/memberChip';
import { snap } from './helpers';

describe('accountRow', () => {
  test('minimal', () => {
    snap(
      accountRow({
        accountId: 'acc-1',
        avatarUri: 'https://img.example/a.png',
        name: 'Main',
        address: '0xabc0000000000000000000000000000000000001',
      }),
    );
  });

  test('full', () => {
    snap(
      accountRow({
        accountId: 'acc-1',
        avatarUri: 'https://img.example/a.png',
        name: 'Main',
        address: '0xabc0000000000000000000000000000000000001',
        typeLabel: 'Smart',
      }),
    );
  });
});

describe('memberChip', () => {
  test('minimal', () => {
    snap(memberChip({ id: 'mem-1', name: 'Bob', avatarUri: 'https://img.example/m.png' }));
  });

  test('full', () => {
    snap(
      memberChip({
        id: 'mem-1',
        name: 'Bob',
        avatarUri: 'https://img.example/m.png',
        background: '#f0f0f0',
        removable: true,
        removeType: 'custom.remove',
      }),
    );
  });
});

describe('memberAddForm', () => {
  test('minimal (idle, invalid)', () => {
    snap(memberAddForm({ draft: '', adding: false, valid: false }));
  });

  test('full (adding with custom types)', () => {
    snap(
      memberAddForm({
        draft: '0xabc0000000000000000000000000000000000001',
        adding: true,
        valid: true,
        changeType: 'custom.change',
        submitType: 'custom.submit',
      }),
    );
  });

  test('valid draft enables the button', () => {
    snap(memberAddForm({ draft: '0xabc', adding: false, valid: true }));
  });
});

