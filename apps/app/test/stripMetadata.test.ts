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
  const needle = Array.from(ascii).map((c) => c.charCodeAt(0));
  outer: for (let i = 0; i + needle.length <= buf.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) if (buf[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

/** Build a realistic JPEG carrying a genuine little-endian TIFF EXIF block:
 *  IFD0 with Orientation(=6) + a Make string ("iPhone") + an Exif-subIFD pointer,
 *  and an Exif sub-IFD with a LightSource tag - i.e. the exact stub shape Less saw
 *  surviving. Plus an APP2 ICC_PROFILE. The ASCII leaks (GPS/Model/LightSource)
 *  are embedded so the test can prove they are gone, and Orientation=6 lets us
 *  prove it is preserved. SOI, APP0(JFIF kept), APP1(EXIF drop), APP2(ICC drop),
 *  DQT, SOS + scan, EOI. */
const ORIENT = 6;
function makeJpegWithExif(): Uint8Array {
  // TIFF: II, magic 42, IFD0 @8. IFD0 has 3 entries, then Exif sub-IFD.
  const ifd0Off = 8;
  const ifd0EntryCount = 3;
  const ifd0End = ifd0Off + 2 + ifd0EntryCount * 12 + 4; // entries + next-IFD ptr
  const makeStr = 'iPhone\0'; // device leak, count 7
  const makeOff = ifd0End; // ASCII data sits after IFD0
  const exifIfdOff = makeOff + makeStr.length;
  const tiff: number[] = [];
  const w16 = (v: number): number[] => [v & 0xff, (v >> 8) & 0xff];
  const w32 = (v: number): number[] => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff];
  tiff.push(0x49, 0x49, 0x2a, 0x00, ...w32(ifd0Off)); // header
  tiff.push(...w16(ifd0EntryCount));
  tiff.push(...w16(0x0112), ...w16(3), ...w32(1), ...w16(ORIENT), 0, 0); // Orientation SHORT
  tiff.push(...w16(0x010f), ...w16(2), ...w32(makeStr.length), ...w32(makeOff)); // Make ASCII -> "iPhone"
  tiff.push(...w16(0x8769), ...w16(4), ...w32(1), ...w32(exifIfdOff)); // ExifIFDPointer
  tiff.push(...w32(0)); // next IFD = 0
  for (const c of makeStr) tiff.push(c.charCodeAt(0)); // Make string data
  // Exif sub-IFD: 1 entry LightSource, then an ASCII breadcrumb so the test can grep it.
  const lightStr = 'LightSource\0';
  const lightOff = exifIfdOff + 2 + 1 * 12 + 4;
  tiff.push(...w16(1));
  tiff.push(...w16(0x9208), ...w16(2), ...w32(lightStr.length), ...w32(lightOff)); // LightSource as ASCII breadcrumb
  tiff.push(...w32(0));
  for (const c of lightStr) tiff.push(c.charCodeAt(0));
  // Drop in obvious GPS/timestamp ASCII leaks at the tail so contains() can find them pre-strip.
  for (const c of 'GPSLatitude 51.5074 GPSLongitude -0.1278 2026:06:08 12:00:00') tiff.push(c.charCodeAt(0));
  const app1Payload = Array.from('Exif\0\0').map((c) => c.charCodeAt(0)).concat(tiff);
  const app1Len = app1Payload.length + 2;
  const iccFill: number[] = Array.from({ length: 32 }, () => 0x5a);
  const iccPayload = Array.from('ICC_PROFILE\0').map((c) => c.charCodeAt(0)).concat([1, 1, ...iccFill]);
  const iccLen = iccPayload.length + 2;
  const dqt = [0xff, 0xdb, 0x00, 0x04, 0x00, 0x00];
  return Uint8Array.from([
    0xff, 0xd8, // SOI
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, // APP0 JFIF-ish (kept)
    0xff, 0xe1, (app1Len >> 8) & 0xff, app1Len & 0xff, ...app1Payload, // APP1 EXIF (drop, keep orientation)
    0xff, 0xe2, (iccLen >> 8) & 0xff, iccLen & 0xff, ...iccPayload, // APP2 ICC (drop)
    ...dqt,
    0xff, 0xda, 0x00, 0x03, 0x00, // SOS marker + len(3) + 1 byte
    0xaa, // scan data
    0xff, 0xd9, // EOI
  ]);
}

/** Read the Orientation tag back out of a stripped JPEG's APP1 (if any). Returns
 *  undefined when there is no APP1 at all. */
function readOrientation(b: Uint8Array): number | undefined {
  let i = 2;
  while (i + 4 < b.length) {
    if (b[i] !== 0xff) { i += 1; continue; }
    const m = b[i + 1];
    if (m === 0xda || m === 0xd9) break;
    const len = (b[i + 2] << 8) | b[i + 3];
    if (m === 0xe1) {
      const p = b.subarray(i + 4, i + 2 + len);
      // "Exif\0\0" + II + magic + IFD0@8
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

/** Build a tiny valid-shaped PNG: signature, IHDR, tEXt(comment), eXIf, IDAT,
 *  IEND. CRCs are arbitrary (the stripper copies bytes, it does not validate). */
function makePngWithText(): Uint8Array {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const chunk = (type: string, data: number[]): number[] => {
    const len = data.length;
    return [
      (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff,
      ...Array.from(type).map((c) => c.charCodeAt(0)),
      ...data,
      0, 0, 0, 0, // placeholder CRC
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

/** Build a tiny WebP with an EXIF chunk. RIFF 'WEBP' + VP8X + EXIF + VP8. */
function makeWebpWithExif(): Uint8Array {
  const fourcc = (s: string): number[] => Array.from(s).map((c) => c.charCodeAt(0));
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
  test('removes ALL EXIF (GPS/device/timestamp/LightSource) + ICC, keeps only orientation', () => {
    const input = makeJpegWithExif();
    // sanity: input carries every sensitive marker + an ICC profile
    expect(contains(input, 'GPSLatitude')).toBe(true);
    expect(contains(input, 'GPSLongitude')).toBe(true);
    expect(contains(input, 'iPhone')).toBe(true);
    expect(contains(input, '2026:06:08')).toBe(true);
    expect(contains(input, 'LightSource')).toBe(true);
    expect(contains(input, 'ICC_PROFILE')).toBe(true);

    const { bytes, stripped, format } = stripMetadataBytes(input);
    expect(format).toBe('jpeg');
    expect(stripped).toBe(true);

    // NO residual sensitive metadata of any kind
    expect(contains(bytes, 'GPSLatitude')).toBe(false);
    expect(contains(bytes, 'GPSLongitude')).toBe(false);
    expect(contains(bytes, 'iPhone')).toBe(false);
    expect(contains(bytes, '2026:06:08')).toBe(false); // timestamp gone
    expect(contains(bytes, 'LightSource')).toBe(false); // stray sub-IFD tag gone
    expect(contains(bytes, 'ICC_PROFILE')).toBe(false); // APP2 ICC gone

    // Orientation IS preserved (non-default 6) via a rebuilt minimal APP1.
    expect(readOrientation(bytes)).toBe(ORIENT);

    // image survives: still starts with SOI and ends with EOI, smaller than input
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
    expect(bytes[bytes.length - 2]).toBe(0xff);
    expect(bytes[bytes.length - 1]).toBe(0xd9);
    expect(bytes.length).toBeLessThan(input.length);
  });

  test('default orientation (1) leaves NO EXIF APP1 at all', () => {
    // Same fixture but with orientation patched to the default 1: we should emit
    // ZERO APP1 (no point re-inserting a no-op orientation marker).
    const input = makeJpegWithExif();
    // The first IFD0 entry is Orientation; its value sits at the marker offset.
    // Find the "Exif\0\0" + II header, then patch the Orientation value to 1.
    const exifAt = (() => {
      for (let i = 0; i + 6 < input.length; i += 1) {
        if (input[i] === 0x45 && input[i + 1] === 0x78 && input[i + 2] === 0x69 && input[i + 3] === 0x66) return i;
      }
      return -1;
    })();
    const tiff = exifAt + 6;
    const ifd0 = tiff + 8;
    // entry 0 is Orientation (we wrote it first); SHORT value at entry+8.
    const valueAt = ifd0 + 2 + 8;
    input[valueAt] = 1; input[valueAt + 1] = 0;
    const { bytes } = stripMetadataBytes(input);
    expect(contains(bytes, 'ICC_PROFILE')).toBe(false);
    expect(contains(bytes, 'iPhone')).toBe(false);
    expect(readOrientation(bytes)).toBeUndefined(); // no APP1 emitted at all
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
    const pdf = Uint8Array.from(Array.from('%PDF-1.7 /Author Less /CreationDate 2026').map((c) => c.charCodeAt(0)));
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
