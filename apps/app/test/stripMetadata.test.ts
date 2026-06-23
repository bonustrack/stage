
import { describe, expect, test } from 'bun:test';
import { stripMetadataBytes, isStrippableImage } from '../lib/stripMetadata';

function contains(buf: Uint8Array, ascii: string): boolean {
  const needle = Array.from(ascii).map((c) => c.charCodeAt(0));
  outer: for (let i = 0; i + needle.length <= buf.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) if (buf[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

const ORIENT = 6;
function makeJpegWithExif(): Uint8Array {
  const ifd0Off = 8;
  const ifd0EntryCount = 3;
  const ifd0End = ifd0Off + 2 + ifd0EntryCount * 12 + 4;
  const makeStr = 'iPhone\0';
  const makeOff = ifd0End;
  const exifIfdOff = makeOff + makeStr.length;
  const tiff: number[] = [];
  const w16 = (v: number): number[] => [v & 0xff, (v >> 8) & 0xff];
  const w32 = (v: number): number[] => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff];
  tiff.push(0x49, 0x49, 0x2a, 0x00, ...w32(ifd0Off));
  tiff.push(...w16(ifd0EntryCount));
  tiff.push(...w16(0x0112), ...w16(3), ...w32(1), ...w16(ORIENT), 0, 0);
  tiff.push(...w16(0x010f), ...w16(2), ...w32(makeStr.length), ...w32(makeOff));
  tiff.push(...w16(0x8769), ...w16(4), ...w32(1), ...w32(exifIfdOff));
  tiff.push(...w32(0));
  for (const c of makeStr) tiff.push(c.charCodeAt(0));
  const lightStr = 'LightSource\0';
  const lightOff = exifIfdOff + 2 + 1 * 12 + 4;
  tiff.push(...w16(1));
  tiff.push(...w16(0x9208), ...w16(2), ...w32(lightStr.length), ...w32(lightOff));
  tiff.push(...w32(0));
  for (const c of lightStr) tiff.push(c.charCodeAt(0));
  for (const c of 'GPSLatitude 51.5074 GPSLongitude -0.1278 2026:06:08 12:00:00') tiff.push(c.charCodeAt(0));
  const app1Payload = Array.from('Exif\0\0').map((c) => c.charCodeAt(0)).concat(tiff);
  const app1Len = app1Payload.length + 2;
  const iccFill: number[] = Array.from({ length: 32 }, () => 0x5a);
  const iccPayload = Array.from('ICC_PROFILE\0').map((c) => c.charCodeAt(0)).concat([1, 1, ...iccFill]);
  const iccLen = iccPayload.length + 2;
  const dqt = [0xff, 0xdb, 0x00, 0x04, 0x00, 0x00];
  return Uint8Array.from([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
    0xff, 0xe1, (app1Len >> 8) & 0xff, app1Len & 0xff, ...app1Payload,
    0xff, 0xe2, (iccLen >> 8) & 0xff, iccLen & 0xff, ...iccPayload,
    ...dqt,
    0xff, 0xda, 0x00, 0x03, 0x00,
    0xaa,
    0xff, 0xd9,
  ]);
}

function readOrientation(b: Uint8Array): number | undefined {
  let i = 2;
  while (i + 4 < b.length) {
    if (b[i] !== 0xff) { i += 1; continue; }
    const m = b[i + 1];
    if (m === 0xda || m === 0xd9) break;
    const len = (b[i + 2] << 8) | b[i + 3];
    if (m === 0xe1) {
      const p = b.subarray(i + 4, i + 2 + len);
      const ifd0 = 6 + 8;
      const count = p[ifd0] | (p[ifd0 + 1] << 8);
      for (let k = 0; k < count; k += 1) {
        const e = ifd0 + 2 + k * 12;
        if ((p[e] | (p[e + 1] << 8)) === 0x0112) return p[e + 8] | (p[e + 9] << 8);
      }
    }
    i += 2 + len;
  }
  return undefined;
}

function makePngWithText(): Uint8Array {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const chunk = (type: string, data: number[]): number[] => {
    const len = data.length;
    return [
      (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff,
      ...Array.from(type).map((c) => c.charCodeAt(0)),
      ...data,
      0, 0, 0, 0,
    ];
  };
  return Uint8Array.from([
    ...sig,
    ...chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]),
    ...chunk('tEXt', Array.from('Comment\0secret GPS here').map((c) => c.charCodeAt(0))),
    ...chunk('eXIf', Array.from('GPSdata').map((c) => c.charCodeAt(0))),
    ...chunk('IDAT', [0x78, 0x9c, 0x00]),
    ...chunk('IEND', []),
  ]);
}

function makeWebpWithExif(): Uint8Array {
  const fourcc = (s: string): number[] => Array.from(s).map((c) => c.charCodeAt(0));
  const chunk = (cc: string, data: number[]): number[] => {
    const sz = data.length;
    const padded = sz & 1 ? [...data, 0] : data;
    return [...fourcc(cc), sz & 0xff, (sz >> 8) & 0xff, (sz >> 16) & 0xff, (sz >> 24) & 0xff, ...padded];
  };
  const vp8x = chunk('VP8X', [0b00001100, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const exif = chunk('EXIF', fourcc('GPSLatitude secret'));
  const vp8 = chunk('VP8 ', [0x00, 0x01, 0x02]);
  const body = [...vp8x, ...exif, ...vp8];
  const riffSize = 4 + body.length;
  return Uint8Array.from([
    ...fourcc('RIFF'), riffSize & 0xff, (riffSize >> 8) & 0xff, (riffSize >> 16) & 0xff, (riffSize >> 24) & 0xff,
    ...fourcc('WEBP'), ...body,
  ]);
}

describe('stripMetadataBytes - JPEG', () => {
  test('removes ALL EXIF (GPS/device/timestamp/LightSource) + ICC, keeps only orientation', () => {
    const input = makeJpegWithExif();
    expect(contains(input, 'GPSLatitude')).toBe(true);
    expect(contains(input, 'GPSLongitude')).toBe(true);
    expect(contains(input, 'iPhone')).toBe(true);
    expect(contains(input, '2026:06:08')).toBe(true);
    expect(contains(input, 'LightSource')).toBe(true);
    expect(contains(input, 'ICC_PROFILE')).toBe(true);

    const { bytes, stripped, format } = stripMetadataBytes(input);
    expect(format).toBe('jpeg');
    expect(stripped).toBe(true);

    expect(contains(bytes, 'GPSLatitude')).toBe(false);
    expect(contains(bytes, 'GPSLongitude')).toBe(false);
    expect(contains(bytes, 'iPhone')).toBe(false);
    expect(contains(bytes, '2026:06:08')).toBe(false);
    expect(contains(bytes, 'LightSource')).toBe(false);
    expect(contains(bytes, 'ICC_PROFILE')).toBe(false);

    expect(readOrientation(bytes)).toBe(ORIENT);

    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
    expect(bytes[bytes.length - 2]).toBe(0xff);
    expect(bytes[bytes.length - 1]).toBe(0xd9);
    expect(bytes.length).toBeLessThan(input.length);
  });

  test('default orientation (1) leaves NO EXIF APP1 at all', () => {
    const input = makeJpegWithExif();
    const exifAt = (() => {
      for (let i = 0; i + 6 < input.length; i += 1) {
        if (input[i] === 0x45 && input[i + 1] === 0x78 && input[i + 2] === 0x69 && input[i + 3] === 0x66) return i;
      }
      return -1;
    })();
    const tiff = exifAt + 6;
    const ifd0 = tiff + 8;
    const valueAt = ifd0 + 2 + 8;
    input[valueAt] = 1; input[valueAt + 1] = 0;
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
    const newSize = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
    expect(newSize).toBe(bytes.length - 8);
  });
});

describe('stripMetadataBytes - unsupported formats', () => {
  test('passes non-image bytes through unchanged and reports stripped=false', () => {
    const pdf = Uint8Array.from(Array.from('%PDF-1.7 /Author Less /CreationDate 2026').map((c) => c.charCodeAt(0)));
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
    expect(isStrippableImage('video/mp4', 'clip.mp4')).toBe(false);
    expect(isStrippableImage('application/pdf', 'doc.pdf')).toBe(false);
    expect(isStrippableImage('image/heic', 'IMG.heic')).toBe(false);
  });
});
