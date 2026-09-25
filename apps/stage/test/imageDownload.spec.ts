import { describe, expect, test } from 'bun:test';
import { imageExtension, imageFileName } from '../lib/imageDownload.model';

describe('image download file name', () => {
  test('takes the extension from the blob type first', () => {
    expect(imageExtension('blob:https://stage.box/3f2a', 'image/png')).toBe('png');
    expect(imageExtension('https://cdn.example/a.gif', 'image/webp')).toBe('webp');
  });

  test('maps jpeg and svg types to their file extensions', () => {
    expect(imageExtension('blob:https://stage.box/3f2a', 'image/jpeg')).toBe('jpg');
    expect(imageExtension('blob:https://stage.box/3f2a', 'image/svg+xml')).toBe('svg');
  });

  test('reads the type of a data uri', () => {
    expect(imageExtension('data:image/png;base64,iVBOR')).toBe('png');
    expect(imageExtension('data:image/JPEG;base64,/9j/')).toBe('jpg');
  });

  test('falls back to the url extension, then to jpg', () => {
    expect(imageExtension('https://cdn.example/avatar.PNG?s=256')).toBe('png');
    expect(imageExtension('https://cdn.example/avatar/0xabc', 'application/octet-stream')).toBe('jpg');
    expect(imageExtension('blob:https://stage.box/3f2a', '')).toBe('jpg');
  });

  test('names the file after the time of the download', () => {
    expect(imageFileName('blob:https://stage.box/3f2a', 'image/png', 1790372619777)).toBe('image-1790372619777.png');
  });
});
