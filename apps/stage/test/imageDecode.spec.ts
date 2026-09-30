import { describe, expect, test } from 'bun:test';
import { bytesToBase64 } from '@stage-labs/client/text/base64';
import { dataUriDecodeSize, viewerResizeMethod } from '../components/imageDecode.model';

function be(value: number, length: number): number[] {
  return Array.from({ length }, (_, k) => (value >> (8 * (length - 1 - k))) & 0xff);
}

function png(width: number, height: number, bitDepth = 8): Uint8Array {
  const ihdr = [...be(width, 4), ...be(height, 4), bitDepth, 6, 0, 0, 0];
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...be(13, 4), 0x49, 0x48, 0x44, 0x52, ...ihdr, 0, 0, 0, 0,
  ]);
}

function jpeg(width: number, height: number, frameMarker = 0xc0): Uint8Array {
  const exif = new Array<number>(3000).fill(0x2a);
  return Uint8Array.from([
    0xff, 0xd8,
    0xff, 0xe0, ...be(16, 2), ...new Array<number>(14).fill(0),
    0xff, 0xe1, ...be(exif.length + 2, 2), ...exif,
    0xff, 0xdb, ...be(4, 2), 0, 0,
    0xff, frameMarker, ...be(17, 2), 8, ...be(height, 2), ...be(width, 2), 3, ...new Array<number>(9).fill(0),
    0xff, 0xda, 0, 0,
  ]);
}

function dataUri(mime: string, bytes: Uint8Array): string {
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}

describe('viewerResizeMethod', () => {
  test('decodes 8-bit screenshots at full resolution, tall ones included', () => {
    expect(viewerResizeMethod({ width: 2560, height: 1600, bytesPerPixel: 4 })).toBe('none');
    expect(viewerResizeMethod({ width: 2560, height: 9000, bytesPerPixel: 4 })).toBe('none');
  });

  test('assumes 8 bytes per pixel when the format is unknown', () => {
    expect(viewerResizeMethod({ width: 4032, height: 3024 })).toBe('none');
    expect(viewerResizeMethod({ width: 2560, height: 6000 })).toBe('scale');
    expect(viewerResizeMethod({ width: 2560, height: 9000, bytesPerPixel: 8 })).toBe('scale');
  });

  test('keeps the capped decode for images too large to draw', () => {
    expect(viewerResizeMethod({ width: 8160, height: 6120, bytesPerPixel: 4 })).toBe('scale');
    expect(viewerResizeMethod(undefined)).toBe('scale');
  });
});

describe('dataUriDecodeSize', () => {
  test('reads the size of an inline PNG and its bit depth', () => {
    expect(dataUriDecodeSize(dataUri('image/png', png(2560, 1600)))).toEqual({ width: 2560, height: 1600, bytesPerPixel: 4 });
    expect(dataUriDecodeSize(dataUri('image/png', png(640, 480, 16)))).toEqual({ width: 640, height: 480, bytesPerPixel: 8 });
  });

  test('reads the size of an inline JPEG past its metadata', () => {
    expect(dataUriDecodeSize(dataUri('image/jpeg', jpeg(4032, 3024)))).toEqual({ width: 4032, height: 3024, bytesPerPixel: 4 });
    expect(dataUriDecodeSize(dataUri('image/jpeg', jpeg(1200, 800, 0xc2)))).toEqual({ width: 1200, height: 800, bytesPerPixel: 4 });
  });

  test('gives no size for other formats, other URIs and broken data', () => {
    expect(dataUriDecodeSize(dataUri('image/gif', Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0])))).toBeUndefined();
    expect(dataUriDecodeSize('file:///cache/photo.jpg')).toBeUndefined();
    expect(dataUriDecodeSize('data:image/svg+xml,<svg/>')).toBeUndefined();
    expect(dataUriDecodeSize('data:image/png;base64,@@@@')).toBeUndefined();
  });
});
