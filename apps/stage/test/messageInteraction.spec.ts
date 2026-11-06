import { describe, expect, it } from 'bun:test';
import { nativeInteraction } from '../components/bubble/messageInteraction.model';

describe('message interaction', () => {
  it.each(['android', 'ios'])('keeps ordinary %s messages on the reaction gesture path', (platform) => {
    expect(nativeInteraction(platform, false)).toBe('gestures');
  });

  it('uses real selectable text outside bubble gestures on Android', () => {
    expect(nativeInteraction('android', true)).toBe('selectableText');
  });

  it('uses a read-only input for range selection instead of whole-message Copy on iOS', () => {
    expect(nativeInteraction('ios', true)).toBe('readonlyInput');
  });

  it.each(['android', 'ios'])('restores %s reaction gestures after selection ends', (platform) => {
    expect(nativeInteraction(platform, true)).not.toBe('gestures');
    expect(nativeInteraction(platform, false)).toBe('gestures');
  });
});
