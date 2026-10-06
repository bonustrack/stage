import { describe, expect, it } from 'bun:test';
import { messageInteraction } from '../components/bubble/messageInteraction.model';

describe('message interaction', () => {
  it.each(['android', 'ios'])('keeps ordinary %s messages on the reaction gesture path', platform => {
    expect(messageInteraction(platform, false)).toBe('gestures');
  });

  it('uses real selectable text outside bubble gestures on Android', () => {
    expect(messageInteraction('android', true)).toBe('selectableText');
  });

  it('uses a read-only input for range selection instead of whole-message Copy on iOS', () => {
    expect(messageInteraction('ios', true)).toBe('readonlyInput');
  });

  it.each(['android', 'ios'])('restores %s reaction gestures after selection ends', platform => {
    expect(messageInteraction(platform, true)).not.toBe('gestures');
    expect(messageInteraction(platform, false)).toBe('gestures');
  });

  it.each([false, true])('preserves browser interaction with selection state %s', selecting => {
    expect(messageInteraction('web', selecting)).toBe('browser');
  });
});
