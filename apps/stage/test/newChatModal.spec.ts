import { describe, expect, test } from 'bun:test';
import { MODE_TABS, chatKey, footerAction, isNewChatMode, phaseNote } from '../components/home/NewChatModal.model';

describe('new chat model', () => {
  test('the switch offers a direct message or a group', () => {
    expect(MODE_TABS.map(t => t.label)).toEqual(['Direct message', 'Group']);
    expect(MODE_TABS.every(t => isNewChatMode(t.value))).toBe(true);
    expect(isNewChatMode('members')).toBe(false);
  });

  test('the footer button names what it does in each mode', () => {
    expect(footerAction('dm', 0)).toEqual({ label: 'Open chat', enabled: false });
    expect(footerAction('dm', 1)).toEqual({ label: 'Open chat', enabled: true });
    expect(footerAction('group', 0)).toEqual({ label: 'Create group', enabled: false });
    expect(footerAction('group', 1)).toEqual({ label: 'Create group (1)', enabled: true });
    expect(footerAction('group', 3)).toEqual({ label: 'Create group (3)', enabled: true });
  });

  test('a created chat is reused only for the same mode and people', () => {
    expect(chatKey('dm', ['0xB0B'])).toBe(chatKey('dm', ['0xb0b']));
    expect(chatKey('group', ['0xb0b', '0xa11ce'])).toBe(chatKey('group', ['0xA11CE', '0xB0B']));
    expect(chatKey('group', ['0xa11ce'])).not.toBe(chatKey('group', ['0xa11ce', '0xb0b']));
    expect(chatKey('dm', ['0xb0b'])).not.toBe(chatKey('group', ['0xb0b']));
  });

  test('the note follows the phase', () => {
    expect(phaseNote('idle')).toBeNull();
    expect(phaseNote('creating')).toBe('Creating the chat…');
    expect(phaseNote('sending')).toBe('Sending…');
  });
});
