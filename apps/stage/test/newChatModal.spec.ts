import { describe, expect, test } from 'bun:test';
import { chatKey, footerAction, isDirectChat, phaseNote, stepTitle } from '../components/home/NewChatModal.model';

describe('new chat model', () => {
  test('the footer button starts the chat, or moves on in the group steps', () => {
    expect(footerAction('chat', 0)).toEqual({ label: 'Open chat', enabled: false, next: null, back: null });
    expect(footerAction('chat', 1)).toEqual({ label: 'Open chat', enabled: true, next: null, back: null });
    expect(footerAction('chat', 2)).toEqual({ label: 'Create group (2)', enabled: true, next: null, back: null });
    expect(footerAction('members', 0)).toEqual({ label: 'Next', enabled: false, next: 'details', back: 'chat' });
    expect(footerAction('members', 2)).toEqual({ label: 'Next (2)', enabled: true, next: 'details', back: 'chat' });
    expect(footerAction('details', 2)).toEqual({ label: 'Create group', enabled: true, next: null, back: 'members' });
  });

  test('only the New chat step titles the modal New chat', () => {
    expect(stepTitle('chat')).toBe('New chat');
    expect(stepTitle('members')).toBe('New group');
    expect(stepTitle('details')).toBe('New group');
  });

  test('one person in New chat is a direct chat, a group otherwise', () => {
    expect(isDirectChat('chat', 1)).toBe(true);
    expect(isDirectChat('chat', 2)).toBe(false);
    expect(isDirectChat('details', 1)).toBe(false);
  });

  test('a created chat is reused only for the same kind and people', () => {
    expect(chatKey('chat', ['0xB0B'])).toBe(chatKey('chat', ['0xb0b']));
    expect(chatKey('details', ['0xb0b', '0xa11ce'])).toBe(chatKey('details', ['0xA11CE', '0xB0B']));
    expect(chatKey('details', ['0xa11ce'])).not.toBe(chatKey('details', ['0xa11ce', '0xb0b']));
    expect(chatKey('chat', ['0xb0b'])).not.toBe(chatKey('details', ['0xb0b']));
    expect(chatKey('chat', ['0xa11ce', '0xb0b'])).toBe(chatKey('details', ['0xB0B', '0xA11CE']));
  });

  test('the note follows the phase', () => {
    expect(phaseNote('idle')).toBeNull();
    expect(phaseNote('creating')).toBe('Creating the chat…');
    expect(phaseNote('sending')).toBe('Sending…');
  });
});
