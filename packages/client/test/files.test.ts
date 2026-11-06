import { describe, expect, test } from 'bun:test';
import { dataUrlBytes, extensionForMime, kindExtensions, mimeForExtension, normalizedMime, withoutQuery } from '../src/files';

describe('file types per use', () => {
  test('a sent file gets its type from its name, including the formats only sending knows', () => {
    expect(mimeForExtension('heif', 'send')).toBe('image/heif');
    expect(mimeForExtension('bmp', 'send')).toBe('image/bmp');
    expect(mimeForExtension('caf', 'send')).toBe('audio/x-caf');
    expect(mimeForExtension('m4a', 'send')).toBe('audio/m4a');
    expect(mimeForExtension('webm', 'send')).toBe('video/webm');
    expect(mimeForExtension('txt', 'send')).toBeUndefined();
    expect(extensionForMime('image/jpeg', 'send')).toBe('jpg');
    expect(extensionForMime('audio/mp4', 'send')).toBeUndefined();
  });

  test('an opened file names m4a as audio/mp4 and knows documents but not every image', () => {
    expect(mimeForExtension('m4a', 'open')).toBe('audio/mp4');
    expect(mimeForExtension('jpeg', 'open')).toBeUndefined();
    expect(extensionForMime('text/plain', 'open')).toBe('txt');
    expect(extensionForMime('image/heif', 'open')).toBeUndefined();
    expect(normalizedMime(undefined, 'clip.M4A')).toBe('audio/mp4');
  });

  test('the kind of a named attachment leaves out heif, bmp and caf', () => {
    expect(kindExtensions('image')).toEqual(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'avif']);
    expect(kindExtensions('audio')).toEqual(['m4a', 'mp3', 'wav', 'aac', 'ogg']);
    expect(kindExtensions('video')).toEqual(['mp4', 'mov', 'webm']);
  });

  test('voice recordings and saved images have their own extensions', () => {
    expect(extensionForMime('audio/x-m4a', 'record')).toBe('m4a');
    expect(extensionForMime('audio/webm', 'record')).toBe('webm');
    expect(extensionForMime('audio/mpeg', 'record')).toBeUndefined();
    expect(extensionForMime('image/svg+xml', 'save')).toBe('svg');
  });

  test('prototype keys are not file types', () => {
    expect(mimeForExtension('constructor', 'send')).toBeUndefined();
    expect(extensionForMime('toString', 'open')).toBeUndefined();
  });
});

describe('dataUrlBytes', () => {
  test('decodes base64 data URLs only', () => {
    expect(dataUrlBytes('data:text/plain;base64,aGk=')).toEqual(new Uint8Array([104, 105]));
    expect(dataUrlBytes('data:text/plain,hi')).toBeNull();
    expect(dataUrlBytes('https://example.com/a.txt')).toBeNull();
  });

  test('withoutQuery drops the query and the fragment', () => {
    expect(withoutQuery('file:///a/b.jpg?x=1#y')).toBe('file:///a/b.jpg');
  });
});
