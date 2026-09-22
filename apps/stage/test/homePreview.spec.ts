import { describe, expect, test } from 'bun:test';
import { NO_MESSAGES_PREVIEW, rowPreviewText } from '../components/home/model';

describe('rowPreviewText', () => {
  test('a DM shows the peer message without their name', () => {
    expect(rowPreviewText({ preview: 'hello', dm: true, fromSelf: false, senderLabel: 'Alice' })).toBe('hello');
  });
  test('my own latest message is prefixed with You in DMs and groups', () => {
    expect(rowPreviewText({ preview: 'hi', dm: true, fromSelf: true, senderLabel: 'Me' })).toBe('You: hi');
    expect(rowPreviewText({ preview: 'hi', dm: false, fromSelf: true, senderLabel: 'Me' })).toBe('You: hi');
  });
  test('a group keeps the sender name', () => {
    expect(rowPreviewText({ preview: 'hello', dm: false, fromSelf: false, senderLabel: 'Alice' })).toBe('Alice: hello');
    expect(rowPreviewText({ preview: 'hello', dm: false, fromSelf: false, senderLabel: null })).toBe('hello');
  });
  test('an empty preview shows the placeholder', () => {
    expect(rowPreviewText({ preview: '', dm: true, fromSelf: false, senderLabel: null })).toBe(NO_MESSAGES_PREVIEW);
  });
});
