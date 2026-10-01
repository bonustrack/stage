import { describe, expect, test } from 'bun:test';
import { pickerRows, togglePick } from '../components/channel/MemberPicker.model';

const toContact = (m: { address: string; label: string }): { address: string; name: string } => ({ address: m.address, name: m.label });

describe('member picker rows', () => {
  test('selected members come first and are not repeated', () => {
    const contacts = [{ address: '0xa', name: 'Alice' }, { address: '0xb', name: 'Bob' }, { address: '0xc', name: 'Chen' }];
    const rows = pickerRows([{ address: '0xC', label: 'Chen' }], contacts, toContact);
    expect(rows.map(r => r.name)).toEqual(['Chen', 'Alice', 'Bob']);
  });

  test('members added by address show even when they are not contacts', () => {
    const rows = pickerRows([{ address: '0xd', label: '0xd' }], [{ address: '0xa', name: 'Alice' }], toContact);
    expect(rows.map(r => r.address)).toEqual(['0xd', '0xa']);
  });

  test('picking adds a person and picking them again removes them', () => {
    const alice = { address: '0xa', label: 'Alice' };
    const bob = { address: '0xb', label: 'Bob' };
    const chen = { address: '0xc', label: 'Chen' };
    expect(togglePick([alice, bob], chen)).toEqual([alice, bob, chen]);
    expect(togglePick([alice, bob], { address: '0xB', label: 'Bob' })).toEqual([alice]);
  });
});
