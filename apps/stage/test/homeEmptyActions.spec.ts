import { describe, expect, test } from 'bun:test';
import { homeEmptyActionModel } from '../components/tabs/HomeScreen.empty.model';

describe('homeEmptyActionModel', () => {
  test('shows start-copy and address action when address is available', () => {
    expect(homeEmptyActionModel('0x5979447096540d08c1fc2e6a0993cd0cfb84652b')).toEqual({
      title: 'No conversations yet',
      body: 'Start a conversation or tap your address to share it.',
      startLabel: 'Start new conversation',
      addressLabel: '0x5979…652b',
      addressHint: 'Tap to copy',
    });
  });

  test('omits address action before active account loads', () => {
    expect(homeEmptyActionModel(null)).toEqual({
      title: 'No conversations yet',
      body: 'Start a conversation or tap your address to share it.',
      startLabel: 'Start new conversation',
      addressLabel: undefined,
      addressHint: undefined,
    });
  });
});
