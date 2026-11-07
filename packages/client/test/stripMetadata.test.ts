import { describe, expect, test } from 'bun:test';
import { stripMetadataBytes, isStrippableImage } from '../src/image/stripMetadata';

const ascii = (text: string): number[] => Array.from(text, (c) => c.charCodeAt(0));
const contains = (buf: Uint8Array, text: string): boolean => Buffer.from(buf).includes(text);
const w16 = (v: number): number[] => [v & 0xff, (v >> 8) & 0xff];
const w32 = (v: number): number[] => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff];

const ORIENT = 6;
function makeJpegWithExif(): Uint8Array {
  const ifd0Off = 8;
  const ifd0EntryCount = 3;
  const ifd0End = ifd0Off + 2 + ifd0EntryCount * 12 + 4;
  const makeStr = 'iPhone\0';
  const makeOff = ifd0End;
  const exifIfdOff = makeOff + makeStr.length;
  const tiff: number[] = [];
  tiff.push(0x49, 0x49, 0x2a, 0x00, ...w32(ifd0Off));
  tiff.push(...w16(ifd0EntryCount));
  tiff.push(...w16(0x0112), ...w16(3), ...w32(1), ...w16(ORIENT), 0, 0);
  tiff.push(...w16(0x010f), ...w16(2), ...w32(makeStr.length), ...w32(makeOff));
  tiff.push(...w16(0x8769), ...w16(4), ...w32(1), ...w32(exifIfdOff));
  tiff.push(...w32(0), ...ascii(makeStr));
  const lightStr = 'LightSource\0';
  const lightOff = exifIfdOff + 2 + 1 * 12 + 4;
  tiff.push(...w16(1));
  tiff.push(...w16(0x9208), ...w16(2), ...w32(lightStr.length), ...w32(lightOff));
  tiff.push(...w32(0), ...ascii(lightStr), ...ascii('GPSLatitude 51.5074 GPSLongitude -0.1278 2026:06:08 12:00:00'));
  const segment = (marker: number, payload: number[]): number[] => [0xff, marker, ...w16(payload.length + 2).reverse(), ...payload];
  const icc = segment(0xe2, [...ascii('ICC_PROFILE\0'), 1, 1, ...Array.from({ length: 32 }, () => 0x5a)]);
  const app1 = segment(0xe1, [...ascii('Exif\0\0'), ...tiff]);
  return Uint8Array.from([
    0xff,
    0xd8,
    ...segment(0xe0, [0, 0]),
    ...app1,
    ...icc,
    ...segment(0xdb, [0, 0]),
    ...segment(0xda, [0]),
    0xaa,
    0xff,
    0xd9,
  ]);
}

const view = (b: Uint8Array): DataView => new DataView(b.buffer, b.byteOffset, b.byteLength);

function readOrientation(b: Uint8Array): number | undefined {
  let i = 2;
  while (i + 4 < b.length) {
    if (b[i] !== 0xff) {
      i += 1;
      continue;
    }
    const m = b[i + 1];
    if (m === 0xda || m === 0xd9) break;
    const len = view(b).getUint16(i + 2);
    if (m === 0xe1) {
      const p = b.subarray(i + 4, i + 2 + len);
      const ifd0 = 6 + 8;
      const count = view(p).getUint16(ifd0, true);
      for (let k = 0; k < count; k += 1) {
        const e = ifd0 + 2 + k * 12;
        if (view(p).getUint16(e, true) === 0x0112) return view(p).getUint16(e + 8, true);
      }
    }
    i += 2 + len;
  }
  return undefined;
}

function makePngWithText(): Uint8Array {
  const chunk = (type: string, data: number[]): number[] => [...w32(data.length).reverse(), ...ascii(type), ...data, 0, 0, 0, 0];
  return Uint8Array.from([
    ...[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    ...chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]),
    ...chunk('tEXt', ascii('Comment\0secret GPS here')),
    ...chunk('eXIf', ascii('GPSdata')),
    ...chunk('IDAT', [0x78, 0x9c, 0x00]),
    ...chunk('IEND', []),
  ]);
}

function makeWebpWithExif(dataSize = 3): Uint8Array {
  const chunk = (cc: string, data: number[]): number[] => [...ascii(cc), ...w32(data.length), ...data, ...(data.length & 1 ? [0] : [])];
  const vp8x = chunk('VP8X', [0b00001100, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const exif = chunk('EXIF', ascii('GPSLatitude secret'));
  const vp8 = chunk(
    'VP8 ',
    Array.from({ length: dataSize }, (_, i) => i % 256),
  );
  const body = [...vp8x, ...exif, ...vp8];
  return Uint8Array.from([...ascii('RIFF'), ...w32(4 + body.length), ...ascii('WEBP'), ...body]);
}

describe('stripMetadataBytes - JPEG', () => {
  test('removes ALL EXIF (GPS/device/timestamp/LightSource) + ICC, keeps only orientation', () => {
    const leaks = ['GPSLatitude', 'GPSLongitude', 'iPhone', '2026:06:08', 'LightSource', 'ICC_PROFILE'];
    const input = makeJpegWithExif();
    for (const leak of leaks) expect(contains(input, leak)).toBe(true);

    const { bytes, stripped, format } = stripMetadataBytes(input);
    expect(format).toBe('jpeg');
    expect(stripped).toBe(true);

    for (const leak of leaks) expect(contains(bytes, leak)).toBe(false);

    expect(readOrientation(bytes)).toBe(ORIENT);

    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
    expect(bytes[bytes.length - 2]).toBe(0xff);
    expect(bytes[bytes.length - 1]).toBe(0xd9);
    expect(bytes.length).toBeLessThan(input.length);
  });

  test('default orientation (1) leaves NO EXIF APP1 at all', () => {
    const input = makeJpegWithExif();
    const tiff = Buffer.from(input).indexOf('Exif') + 6;
    const ifd0 = tiff + 8;
    const valueAt = ifd0 + 2 + 8;
    input[valueAt] = 1;
    input[valueAt + 1] = 0;
    const { bytes } = stripMetadataBytes(input);
    expect(contains(bytes, 'ICC_PROFILE')).toBe(false);
    expect(contains(bytes, 'iPhone')).toBe(false);
    expect(readOrientation(bytes)).toBeUndefined();
  });
});

describe('stripMetadataBytes - PNG', () => {
  test('removes tEXt + eXIf chunks while keeping IHDR/IDAT/IEND', () => {
    const input = makePngWithText();
    expect(contains(input, 'secret GPS here')).toBe(true);
    const { bytes, stripped, format } = stripMetadataBytes(input);
    expect(format).toBe('png');
    expect(stripped).toBe(true);
    expect(contains(bytes, 'secret GPS here')).toBe(false);
    expect(contains(bytes, 'tEXt')).toBe(false);
    expect(contains(bytes, 'eXIf')).toBe(false);
    expect(contains(bytes, 'IHDR')).toBe(true);
    expect(contains(bytes, 'IDAT')).toBe(true);
    expect(contains(bytes, 'IEND')).toBe(true);
  });
});

describe('stripMetadataBytes - WebP', () => {
  test('removes EXIF chunk and clears VP8X flags while keeping VP8 data', () => {
    const input = makeWebpWithExif();
    expect(contains(input, 'GPSLatitude secret')).toBe(true);
    const { bytes, stripped, format } = stripMetadataBytes(input);
    expect(format).toBe('webp');
    expect(stripped).toBe(true);
    expect(contains(bytes, 'GPSLatitude secret')).toBe(false);
    expect(contains(bytes, 'EXIF')).toBe(false);
    expect(contains(bytes, 'VP8 ')).toBe(true);
    expect(view(bytes).getUint32(4, true)).toBe(bytes.length - 8);
  });

  test('strips metadata from large WebP chunks without changing image data', () => {
    const dataSize = 2_000_000;
    const input = makeWebpWithExif(dataSize);
    const { bytes, stripped, format } = stripMetadataBytes(input);
    expect(format).toBe('webp');
    expect(stripped).toBe(true);
    expect(contains(bytes, 'GPSLatitude secret')).toBe(false);
    expect(bytes.subarray(bytes.length - dataSize)).toEqual(input.subarray(input.length - dataSize));
    expect(bytes[20]).toBe(0);
  });
});

describe('stripMetadataBytes - unsupported formats', () => {
  test('passes non-image bytes through unchanged and reports stripped=false', () => {
    const pdf = Uint8Array.from(ascii('%PDF-1.7 /Author Less /CreationDate 2026'));
    const { bytes, stripped, format } = stripMetadataBytes(pdf);
    expect(format).toBe('unsupported');
    expect(stripped).toBe(false);
    expect(bytes).toEqual(pdf);
  });
});

describe('isStrippableImage', () => {
  test('matches jpeg/png/webp by mime or extension, rejects others', () => {
    expect(isStrippableImage('image/jpeg', undefined)).toBe(true);
    expect(isStrippableImage(undefined, 'photo.PNG')).toBe(true);
    expect(isStrippableImage('image/webp', 'x.webp')).toBe(true);
    expect(isStrippableImage('IMAGE/JPG', undefined)).toBe(true);
    expect(isStrippableImage(undefined, 'scan.jpeg')).toBe(true);
    expect(isStrippableImage('video/mp4', 'clip.mp4')).toBe(false);
    expect(isStrippableImage('application/pdf', 'doc.pdf')).toBe(false);
    expect(isStrippableImage('image/heic', 'IMG.heic')).toBe(false);
  });
});
