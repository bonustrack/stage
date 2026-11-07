import { describe, expect, test } from 'bun:test';
import { CHANNEL_WAITING_NOTICE } from '../components/channel/accessNotices';

describe('channel access notices', () => {
  test('the waiting notice says how the device gets added', () => {
    expect(CHANNEL_WAITING_NOTICE).toContain('sends a message');
  });
});
