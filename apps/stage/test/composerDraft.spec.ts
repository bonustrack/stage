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
});
