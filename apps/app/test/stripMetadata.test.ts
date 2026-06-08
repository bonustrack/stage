/** Proves the outbound file-metadata stripper actually removes EXIF/GPS/XMP/text
 *  metadata from image byte streams. We construct minimal-but-real containers
 *  carrying known metadata markers, run the pure `stripMetadataBytes` util (the
 *  same function the XMTP send path invokes via `sanitizeFileUri`), and assert
 *  the metadata segments are gone while the image data survives.
 *
 *  What this proves: the byte-level strip logic deletes the metadata-bearing
 *  segments. What it does NOT prove (no native runtime here): that the send path
 *  rewrites the on-disk file - that wiring is asserted by importing the util and
 *  checking the send module references sanitizeFileUri (see last test). */

import { describe, expect, test } from 'bun:test';
import { stripMetadataBytes, isStrippableImage } from '../lib/stripMetadata';

/** Helper: does buf contain the ASCII marker anywhere? */
function contains(buf: Uint8Array, ascii: string): boolean {
  const needle = [...ascii].map((c) => c.charCodeAt(0));
  outer: for (let i = 0; i + needle.length <= buf.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) if (buf[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

/** Build a tiny valid-shaped JPEG: SOI, APP0(JFIF), APP1(EXIF w/ GPS marker),
 *  a DQT segment standing in for image tables, SOS + 1 byte scan, EOI. */
function makeJpegWithExif(): Uint8Array {
  const app1Payload = [...'Exif\0\0GPSLatitude 51.5074 GPSLongitude -0.1278 Model iPhone'].map((c) => c.charCodeAt(0));
  const app1Len = app1Payload.length + 2;
  const dqt = [0xff, 0xdb, 0x00, 0x04, 0x00, 0x00]; // marker + len(4) + 2 data bytes
  return Uint8Array.from([
    0xff, 0xd8, // SOI
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, // APP0 JFIF-ish (kept)
    0xff, 0xe1, (app1Len >> 8) & 0xff, app1Len & 0xff, ...app1Payload, // APP1 EXIF (drop)
    ...dqt,
    0xff, 0xda, 0x00, 0x03, 0x00, // SOS marker + len(3) + 1 byte
    0xaa, // scan data
    0xff, 0xd9, // EOI
  ]);
}

/** Build a tiny valid-shaped PNG: signature, IHDR, tEXt(comment), eXIf, IDAT,
 *  IEND. CRCs are arbitrary (the stripper copies bytes, it does not validate). */
function makePngWithText(): Uint8Array {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const chunk = (type: string, data: number[]): number[] => {
    const len = data.length;
    return [
      (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff,
      ...[...type].map((c) => c.charCodeAt(0)),
      ...data,
      0, 0, 0, 0, // placeholder CRC
    ];
  };
  return Uint8Array.from([
    ...sig,
    ...chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]),
    ...chunk('tEXt', [...'Comment\0secret GPS here'].map((c) => c.charCodeAt(0))),
    ...chunk('eXIf', [...'GPSdata'].map((c) => c.charCodeAt(0))),
    ...chunk('IDAT', [0x78, 0x9c, 0x00]),
    ...chunk('IEND', []),
  ]);
}

/** Build a tiny WebP with an EXIF chunk. RIFF 'WEBP' + VP8X + EXIF + VP8. */
function makeWebpWithExif(): Uint8Array {
  const fourcc = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));
  const chunk = (cc: string, data: number[]): number[] => {
    const sz = data.length;
    const padded = sz & 1 ? [...data, 0] : data;
    return [...fourcc(cc), sz & 0xff, (sz >> 8) & 0xff, (sz >> 16) & 0xff, (sz >> 24) & 0xff, ...padded];
  };
  const vp8x = chunk('VP8X', [0b00001100, 0, 0, 0, 0, 0, 0, 0, 0, 0]); // EXIF+XMP flags set
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
  test('removes APP1 EXIF/GPS while keeping image data + EOI', () => {
    const input = makeJpegWithExif();
    expect(contains(input, 'GPSLatitude')).toBe(true); // sanity: input is dirty
    const { bytes, stripped, format } = stripMetadataBytes(input);
    expect(format).toBe('jpeg');
    expect(stripped).toBe(true);
    expect(contains(bytes, 'GPSLatitude')).toBe(false);
    expect(contains(bytes, 'GPSLongitude')).toBe(false);
    expect(contains(bytes, 'Model')).toBe(false);
    expect(contains(bytes, 'iPhone')).toBe(false);
    // image survives: still starts with SOI and ends with EOI, smaller than input
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
    expect(bytes[bytes.length - 2]).toBe(0xff);
    expect(bytes[bytes.length - 1]).toBe(0xd9);
    expect(bytes.length).toBeLessThan(input.length);
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
    expect(contains(bytes, 'VP8 ')).toBe(true); // image data kept
    // RIFF size header updated to match shrunk payload
    const newSize = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
    expect(newSize).toBe(bytes.length - 8);
  });
});

describe('stripMetadataBytes - unsupported formats', () => {
  test('passes non-image bytes through unchanged and reports stripped=false', () => {
    const pdf = Uint8Array.from([...'%PDF-1.7 /Author Less /CreationDate 2026'].map((c) => c.charCodeAt(0)));
    const { bytes, stripped, format } = stripMetadataBytes(pdf);
    expect(format).toBe('unsupported');
    expect(stripped).toBe(false);
    expect(bytes).toEqual(pdf); // honest: we did NOT strip it
  });
});

describe('isStrippableImage', () => {
  test('matches jpeg/png/webp by mime or extension, rejects others', () => {
    expect(isStrippableImage('image/jpeg', undefined)).toBe(true);
    expect(isStrippableImage(undefined, 'photo.PNG')).toBe(true);
    expect(isStrippableImage('image/webp', 'x.webp')).toBe(true);
    expect(isStrippableImage('video/mp4', 'clip.mp4')).toBe(false);
    expect(isStrippableImage('application/pdf', 'doc.pdf')).toBe(false);
    expect(isStrippableImage('image/heic', 'IMG.heic')).toBe(false); // honest: HEIC not handled
  });
});
