import { describe, expect, test } from 'bun:test';
import {
  galleryItemsOf, galleryKeyOf, galleryKeyStep, galleryStep, isEditableTarget, type GalleryKeyEvent,
} from '../components/bubble/imageGallery.model';

interface Att { kind: string; url: string }
interface Entry { id: string; atts: Att[] }

const img = (url: string): Att => ({ kind: 'image', url });
const file = (url: string): Att => ({ kind: 'file', url });

const newestFirst: Entry[] = [
  { id: 'm4', atts: [img('d')] },
  { id: 'm3', atts: [] },
  { id: 'm2', atts: [img('b'), file('doc'), img('c')] },
  { id: 'm1', atts: [img('a')] },
];

const items = galleryItemsOf(newestFirst, e => e.atts);
const urls = (list: readonly { att: Att }[]): string[] => list.map(i => i.att.url);

const press = (key: string, extra: Partial<GalleryKeyEvent> = {}): GalleryKeyEvent => ({
  key, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, defaultPrevented: false, ...extra,
});

describe('chat image gallery', () => {
  test('lists the images of the chat oldest first, in attachment order within a message', () => {
    expect(urls(items)).toEqual(['a', 'b', 'c', 'd']);
    expect(items.map(i => i.key)).toEqual(['m1#0', 'm2#0', 'm2#2', 'm4#0']);
  });

  test('keys an item by its message and attachment index', () => {
    expect(galleryKeyOf('m2', 2)).toBe('m2#2');
    expect(items[2]).toMatchObject({ entryId: 'm2', index: 2 });
  });

  test('steps to the next and previous image, skipping non-image attachments', () => {
    expect(galleryStep(items, 'm2#0', 1)?.att.url).toBe('c');
    expect(galleryStep(items, 'm2#2', -1)?.att.url).toBe('b');
    expect(galleryStep(items, 'm2#2', 1)?.att.url).toBe('d');
  });

  test('stops at both ends instead of wrapping', () => {
    expect(galleryStep(items, 'm1#0', -1)).toBeNull();
    expect(galleryStep(items, 'm4#0', 1)).toBeNull();
  });

  test('does nothing for an image that is not in the chat', () => {
    expect(galleryStep(items, 'gone#0', 1)).toBeNull();
  });
});

describe('gallery arrow keys', () => {
  test('left goes back and right goes forward', () => {
    expect(galleryKeyStep(press('ArrowLeft'), false)).toBe(-1);
    expect(galleryKeyStep(press('ArrowRight'), false)).toBe(1);
  });

  test('ignores other keys', () => {
    expect(galleryKeyStep(press('ArrowUp'), false)).toBe(0);
    expect(galleryKeyStep(press('Enter'), false)).toBe(0);
  });

  test('leaves arrows alone while a text field has focus', () => {
    expect(galleryKeyStep(press('ArrowRight'), true)).toBe(0);
  });

  test('leaves modified or already handled arrows alone', () => {
    expect(galleryKeyStep(press('ArrowRight', { shiftKey: true }), false)).toBe(0);
    expect(galleryKeyStep(press('ArrowLeft', { altKey: true }), false)).toBe(0);
    expect(galleryKeyStep(press('ArrowLeft', { metaKey: true }), false)).toBe(0);
    expect(galleryKeyStep(press('ArrowRight', { ctrlKey: true }), false)).toBe(0);
    expect(galleryKeyStep(press('ArrowRight', { defaultPrevented: true }), false)).toBe(0);
  });

  test('treats inputs, text areas, selects and contenteditable as text fields', () => {
    expect(isEditableTarget('INPUT', false)).toBe(true);
    expect(isEditableTarget('TEXTAREA', false)).toBe(true);
    expect(isEditableTarget('SELECT', false)).toBe(true);
    expect(isEditableTarget('DIV', true)).toBe(true);
    expect(isEditableTarget('DIV', false)).toBe(false);
    expect(isEditableTarget(null, false)).toBe(false);
  });
});
