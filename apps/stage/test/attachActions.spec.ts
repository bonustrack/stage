import { describe, expect, test } from 'bun:test';
import { offeredAttachKinds, quickAttachOf } from '../components/composer/attachActions.model';

describe('composer attach actions', () => {
  test('a chat offers every action, voice first where the mic dictates', () => {
    expect(offeredAttachKinds({ draftOnly: false, voiceInMenu: true }).map((a) => a.label)).toEqual([
      'Voice message',
      'Image',
      'Camera',
      'File',
      'Location',
      'Poll',
      'Sign',
      'Payment',
    ]);
    expect(offeredAttachKinds({ draftOnly: false, voiceInMenu: false }).map((a) => a.id)).not.toContain('voice');
  });

  test('a draft offers only files, photos and voice', () => {
    expect(offeredAttachKinds({ draftOnly: true, voiceInMenu: true }).map((a) => a.id)).toEqual(['voice', 'image', 'camera', 'file']);
  });

  test('the quick button repeats the last action only when it is offered here', () => {
    const draft = offeredAttachKinds({ draftOnly: true, voiceInMenu: false });
    expect(quickAttachOf(draft, 'camera')?.label).toBe('Camera');
    expect(quickAttachOf(draft, 'poll')).toBeUndefined();
    expect(quickAttachOf(draft, undefined)).toBeUndefined();
  });
});
