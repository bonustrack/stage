import { describe, expect, test } from 'bun:test';
import { openChatLabel, phaseNote, recipientsKey } from '../components/home/NewChatModal.model';

describe('new chat model', () => {
  test('the recipients key ignores order and case', () => {
    expect(recipientsKey(['0xB0B', '0xa11ce'])).toBe(recipientsKey(['0xA11CE', '0xb0b']));
    expect(recipientsKey(['0xa11ce'])).not.toBe(recipientsKey(['0xa11ce', '0xb0b']));
  });

  test('one person opens a chat, more create a group', () => {
    expect(openChatLabel(1)).toBe('Open chat');
    expect(openChatLabel(3)).toBe('Create group (3)');
  });

  test('the note follows the phase', () => {
    expect(phaseNote('idle')).toBeNull();
    expect(phaseNote('creating')).toBe('Creating the chat…');
    expect(phaseNote('sending')).toBe('Sending…');
  });
});
