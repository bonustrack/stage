import { describe, expect, test } from 'bun:test';
import { unsentDraft } from '../components/composer/draft.model';

const photo = { id: 'a1', url: 'blob:photo' };
const voice = { id: 'a2', url: 'blob:voice' };

describe('composer draft after a failed send', () => {
  test('everything stays when nothing went out', () => {
    const unsent = [{ text: 'hi', attachments: [] }, { text: '', attachments: [photo] }];
    expect(unsentDraft('hi ', [photo], unsent)).toEqual({ text: 'hi ', pending: [photo] });
  });

  test('only what did not go out stays', () => {
    const unsent = [{ text: '', attachments: [{ id: 'a2' }] }];
    expect(unsentDraft('hi', [photo, voice], unsent)).toEqual({ text: '', pending: [voice] });
  });

  test('the draft is empty when everything went out', () => {
    expect(unsentDraft('hi', [photo], [])).toEqual({ text: '', pending: [] });
  });

  test('a failed location stays pending without bringing back a caption that went out', () => {
    const location = { id: 'l1', url: 'https://www.google.com/maps/search/?api=1&query=1,2' };
    const unsent = [{ text: '📍 https://www.google.com/maps/search/?api=1&query=1,2', attachments: [], location }];
    expect(unsentDraft('see you', [photo, location], unsent)).toEqual({ text: '', pending: [location] });
  });
});
