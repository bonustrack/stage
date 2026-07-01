import { describe, test } from 'bun:test';
import { accountRow } from '../src/accounts/accountRow';
import { contactRow } from '../src/accounts/contactRow';
import { memberAddForm } from '../src/accounts/memberAddForm';
import { memberChip } from '../src/accounts/memberChip';
import { memberRow } from '../src/accounts/memberRow';
import { memberTextField } from '../src/accounts/memberTextField';
import { suggestionRow } from '../src/accounts/suggestionRow';
import { topnavIdentity } from '../src/accounts/topnavIdentity';
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

describe('topnavIdentity', () => {
  test('minimal (no avatar)', () => {
    snap(topnavIdentity({ name: 'Alice' }));
  });

  test('full', () => {
    snap(
      topnavIdentity({
        avatarUri: 'https://img.example/a.png',
        avatarBackground: '#eeeeee',
        name: 'Alice',
      }),
    );
  });

  test('empty name renders avatar only', () => {
    snap(topnavIdentity({ name: '', avatarBackground: '#eeeeee' }));
  });
});

const MEMBER_BASE = {
  memberId: 'mem-1',
  avatarUri: 'https://img.example/m.png',
  name: 'Bob',
  dark: false,
  borderColor: '#dddddd',
  subColor: '#666666',
  dangerColor: '#ff0000',
  removePressedBg: '#ffeeee',
};

describe('memberRow', () => {
  test('minimal', () => {
    snap(memberRow(MEMBER_BASE));
  });

  test('full with owner badge and remove button', () => {
    snap(
      memberRow({
        ...MEMBER_BASE,
        dark: true,
        address: '0xabc0000000000000000000000000000000000001',
        role: 'owner',
        removable: true,
      }),
    );
  });

  test('admin badge variant', () => {
    snap(memberRow({ ...MEMBER_BASE, role: 'admin' }));
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

const FIELD_BASE = {
  value: '0xabc',
  placeholder: 'Address',
  color: '#111111',
  placeholderColor: '#999999',
  inputBg: '#ffffff',
  border: '#dddddd',
  radius: 8,
  paddingX: 12,
  paddingY: 8,
};

describe('memberTextField', () => {
  test('minimal', () => {
    snap(memberTextField(FIELD_BASE));
  });

  test('full', () => {
    snap(
      memberTextField({
        ...FIELD_BASE,
        autoFocus: true,
        autoCapitalize: 'none',
        autoCorrect: false,
        returnKeyType: 'done',
        changeType: 'custom.change',
        submitType: 'custom.submit',
      }),
    );
  });
});

describe('contactRow', () => {
  test('minimal', () => {
    snap(contactRow({ name: 'Carol', avatarUri: 'https://img.example/c.png' }));
  });

  test('full', () => {
    snap(
      contactRow({
        name: 'Carol',
        avatarUri: 'https://img.example/c.png',
        handle: 'carol.eth',
        trailingBadge: 'Agent',
        pressType: 'custom.contact',
        payload: { address: '0xabc' },
      }),
    );
  });
});

describe('suggestionRow', () => {
  test('minimal (unselected)', () => {
    snap(
      suggestionRow({
        address: '0xabc0000000000000000000000000000000000001',
        name: 'Dave',
        avatarUri: 'https://img.example/d.png',
      }),
    );
  });

  test('full (selected)', () => {
    snap(
      suggestionRow({
        address: '0xabc0000000000000000000000000000000000001',
        name: 'Dave',
        avatarUri: 'https://img.example/d.png',
        handle: 'dave.eth',
        selected: true,
        checkBackground: '#00aa00',
        toggleType: 'custom.toggle',
      }),
    );
  });
});
