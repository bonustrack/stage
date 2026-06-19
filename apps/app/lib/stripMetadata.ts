/**
 * @file Pure-JS byte-stream stripper that losslessly removes privacy-leaking metadata (EXIF/GPS, XMP, ICC) from outbound JPEG/PNG/WebP files before encrypt + upload, applied unconditionally in the send path.
 *  Keeps pixels intact (JPEG retains only a rebuilt orientation-only EXIF); formats it cannot safely rewrite on-device (HEIC, MP4/MOV, PDF) pass through unchanged and report `wasStripped()` false so callers never assume clean.
 */

/** A metadata-strip outcome. `bytes` is always safe to send; when `stripped` is false the original bytes are returned unchanged (unsupported format) and the caller knows residual metadata MAY remain. */
export interface StripResult {
  bytes: Uint8Array;
  /** True only when we actively rewrote the container and removed metadata segments (or confirmed there were none in a format we fully control). */
  stripped: boolean;
  /** Detected container, for logging/telemetry. */
  format: 'jpeg' | 'png' | 'webp' | 'unsupported';
}

/** U8 helper. */
const u8 = (a: number | undefined, b: number): boolean => a === b;

/** Little/big-endian aware TIFF readers over an "Exif\0\0"-prefixed payload. */
interface TiffReader {
  /** Read a 16-bit unsigned int at byte offset `o`. */
  u16: (o: number) => number;
  /** Read a 32-bit unsigned int at byte offset `o`. */
  u32: (o: number) => number;
  /** Byte offset of the TIFF header within the payload. */
  tiff: number;
}

/** Build endian-aware TIFF readers for an APP1 payload, or undefined if it lacks a valid Exif/TIFF header. */
function tiffReaderFor(payload: Uint8Array): TiffReader | undefined {
  /** Bounds-guarded byte read; out-of-range reads as 0 (satisfies noUncheckedIndexedAccess). */
  const at = (o: number): number => payload[o] ?? 0;
  // payload starts with "Exif\0\0" then the TIFF header.
  if (payload.length < 6 + 8) return undefined;
  if (at(0) !== 0x45 || at(1) !== 0x78 || at(2) !== 0x69 || at(3) !== 0x66) return undefined;
  const tiff = 6; // offset of the TIFF header within the payload
  const le = at(tiff) === 0x49 && at(tiff + 1) === 0x49; // 'II' little / 'MM' big
  const be = at(tiff) === 0x4d && at(tiff + 1) === 0x4d;
  if (!le && !be) return undefined;
  /** U16 helper. */
  const u16 = (o: number): number => (le ? at(o) | (at(o + 1) << 8) : (at(o) << 8) | at(o + 1));
  /** U32 helper. */
  const u32 = (o: number): number => (le
    ? at(o) | (at(o + 1) << 8) | (at(o + 2) << 16) | (at(o + 3) << 24)
    : (at(o) << 24) | (at(o + 1) << 16) | (at(o + 2) << 8) | at(o + 3));
  return { u16, u32, tiff };
}

/**
 * Read the EXIF Orientation tag (TIFF tag 0x0112) out of a JPEG APP1 payload.
 *  Returns the 1..8 value, or undefined if absent / unparseable / the default 1.
 *  Orientation is the ONE tag worth preserving: it is not a privacy leak (just a
 *  display-rotation hint, 1..8) and dropping it would make some camera photos
 *  show up rotated, because a lossless container rewrite cannot re-bake pixels.
 *  We parse only IFD0 (the rotation lives there); we never follow the Exif/GPS
 *  sub-IFD pointers, so no other tag is ever read or kept.
 */
function readJpegOrientation(payload: Uint8Array): number | undefined {
  const r = tiffReaderFor(payload);
  if (!r) return undefined;
  const ifd0 = r.tiff + r.u32(r.tiff + 4);
  if (ifd0 + 2 > payload.length) return undefined;
  const count = r.u16(ifd0);
  for (let k = 0; k < count; k += 1) {
    const entry = ifd0 + 2 + k * 12;
    if (entry + 12 > payload.length) break;
    if (r.u16(entry) === 0x0112) { // Orientation
      const v = r.u16(entry + 8); // SHORT value sits in the value field
      return v >= 1 && v <= 8 ? v : undefined;
    }
  }
  return undefined;
}

/**
 * Build a minimal APP1 EXIF segment carrying ONLY the Orientation tag. Little-
 *  endian TIFF, single IFD0 entry, no sub-IFDs, no thumbnail. ~26 bytes - it
 *  cannot encode GPS, camera make/model, timestamps, LightSource or any other
 *  leak because we literally do not write those entries.
 */
function buildOrientationApp1(orientation: number): number[] {
  const tiff = [
    0x49, 0x49, 0x2a, 0x00, // 'II' little-endian, magic 42
    0x08, 0x00, 0x00, 0x00, // IFD0 at offset 8
    0x01, 0x00, // 1 directory entry
    0x12, 0x01, // tag 0x0112 Orientation
    0x03, 0x00, // type SHORT
    0x01, 0x00, 0x00, 0x00, // count 1
    orientation & 0xff, 0x00, 0x00, 0x00, // value (SHORT in low 2 bytes)
    0x00, 0x00, 0x00, 0x00, // next IFD = 0
  ];
  const payload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff]; // "Exif\0\0" + TIFF
  const len = payload.length + 2;
  return [0xff, 0xe1, (len >> 8) & 0xff, len & 0xff, ...payload];
}

/** Mutable scan state threaded through the JPEG marker walk. */
interface JpegScan {
  /** Output bytes accumulated so far. */
  out: number[];
  /** Captured non-default orientation, if any. */
  orientation: number | undefined;
  /** Current read offset; -1 signals the walk should stop. */
  next: number;
}

/** Handle a length-bearing JPEG segment (APPn/COM/other): capture orientation, drop metadata markers, copy the rest. */
function handleJpegSegment(b: Uint8Array, at: (o: number) => number, i: number, marker: number, s: JpegScan): void {
  const len = (at(i + 2) << 8) | at(i + 3); // segment length incl. these 2 bytes
  if (marker === 0xe1) { // APP1 — capture orientation before dropping
    const payload = b.subarray(i + 4, i + 2 + len);
    s.orientation = s.orientation ?? readJpegOrientation(payload);
  }
  const dropApp = marker >= 0xe1 && marker <= 0xef; // APP1..APP15 (keep APP0 JFIF)
  const dropCom = marker === 0xfe; // COM comment
  if (!dropApp && !dropCom) {
    for (let j = i; j < i + 2 + len; j += 1) s.out.push(at(j));
  }
  s.next = i + 2 + len;
}

/** Process one JPEG marker at offset `i`, mutating scan state and advancing `s.next` (-1 to stop). */
function stepJpegMarker(b: Uint8Array, at: (o: number) => number, i: number, s: JpegScan): void {
  if (at(i) !== 0xff) { // resync defensively; copy byte
    s.out.push(at(i)); s.next = i + 1; return;
  }
  const marker = at(i + 1);
  if (marker === 0xd9) { s.out.push(0xff, 0xd9); s.next = -1; return; } // EOI
  if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { // standalone markers
    s.out.push(0xff, marker); s.next = i + 2; return;
  }
  if (marker === 0xda) { // start of scan: copy the rest unchanged
    for (let j = i; j < b.length; j += 1) s.out.push(at(j));
    s.next = -1; return;
  }
  handleJpegSegment(b, at, i, marker, s);
}

/** Strip metadata markers (APP1..APP15, COM) from a JPEG while preserving a non-default orientation as a minimal APP1, copying scan data verbatim. */
function stripJpeg(b: Uint8Array): Uint8Array {
  /** At helper. */
  const at = (o: number): number => b[o] ?? 0;
  const s: JpegScan = { out: [0xff, 0xd8], orientation: undefined, next: 2 };
  let i = 2;
  while (i + 1 < b.length) {
    stepJpegMarker(b, at, i, s);
    if (s.next < 0) break;
    i = s.next;
  }
  // Re-insert an orientation-only EXIF right after SOI when rotation is non-default.
  if (s.orientation !== undefined && s.orientation !== 1) {
    s.out.splice(2, 0, ...buildOrientationApp1(s.orientation));
  }
  return Uint8Array.from(s.out);
}

/**
 * PNG: 8-byte signature then length-prefixed chunks. We drop ancillary chunks
 *  that carry metadata (tEXt/zTXt/iTXt text, tIME timestamp, eXIf EXIF) and copy
 *  every other chunk (IHDR, PLTE, IDAT, IEND, color/gamma rendering chunks)
 *  verbatim, including their original CRCs.
 */
const PNG_DROP = new Set(['tEXt', 'zTXt', 'iTXt', 'tIME', 'eXIf']);
/** Strip Png. */
function stripPng(b: Uint8Array): Uint8Array {
  /** At helper. */
  const at = (o: number): number => b[o] ?? 0;
  const out: number[] = [];
  for (let k = 0; k < 8; k += 1) out.push(at(k)); // signature
  let i = 8;
  while (i + 8 <= b.length) {
    const len = (at(i) << 24) | (at(i + 1) << 16) | (at(i + 2) << 8) | at(i + 3);
    const type = String.fromCharCode(at(i + 4), at(i + 5), at(i + 6), at(i + 7));
    const total = 12 + len; // length(4) + type(4) + data(len) + crc(4)
    if (i + total > b.length) break; // truncated; stop
    if (!PNG_DROP.has(type)) {
      for (let j = i; j < i + total; j += 1) out.push(at(j));
    }
    i += total;
    if (type === 'IEND') break;
  }
  return Uint8Array.from(out);
}

/**
 * WebP: RIFF container. Drop the `EXIF` and `XMP ` chunks; copy VP8/VP8L/VP8X/
 *  ALPH/ANIM/ANMF chunks. Fix up the RIFF size header to match the new payload.
 *  (We also clear the EXIF/XMP flag bits in a VP8X header so decoders don't look
 *  for chunks we removed.)
 */
function stripWebp(b: Uint8Array): Uint8Array {
  /** At helper. */
  const at = (o: number): number => b[o] ?? 0;
  const head = Array.from(b.slice(0, 12)); // 'RIFF' size 'WEBP'
  const body: number[] = [];
  let i = 12;
  while (i + 8 <= b.length) {
    const fourcc = String.fromCharCode(at(i), at(i + 1), at(i + 2), at(i + 3));
    const size = at(i + 4) | (at(i + 5) << 8) | (at(i + 6) << 16) | (at(i + 7) << 24);
    const padded = size + (size & 1); // chunks are padded to even length
    const total = 8 + padded;
    if (i + total > b.length) break;
    if (fourcc !== 'EXIF' && fourcc !== 'XMP ') {
      const chunk = Array.from(b.slice(i, i + total));
      if (fourcc === 'VP8X') chunk[8] = (chunk[8] ?? 0) & ~0b00001100; // clear EXIF(0x08)+XMP(0x04) flags
      body.push(...chunk);
    }
    i += total;
  }
  const newSize = 4 + body.length; // 'WEBP' + chunks
  head[4] = newSize & 0xff;
  head[5] = (newSize >> 8) & 0xff;
  head[6] = (newSize >> 16) & 0xff;
  head[7] = (newSize >> 24) & 0xff;
  return Uint8Array.from([...head, ...body]);
}

/** True when bytes start with the JPEG SOI magic. */
function isJpeg(b: Uint8Array): boolean {
  return b.length >= 3 && u8(b[0], 0xff) && u8(b[1], 0xd8) && u8(b[2], 0xff);
}

/** True when bytes start with the 8-byte PNG signature. */
function isPng(b: Uint8Array): boolean {
  return b.length >= 8 && u8(b[0], 0x89) && u8(b[1], 0x50) && u8(b[2], 0x4e) && u8(b[3], 0x47)
    && u8(b[4], 0x0d) && u8(b[5], 0x0a) && u8(b[6], 0x1a) && u8(b[7], 0x0a);
}

/** True when bytes are a RIFF/WEBP container. */
function isWebp(b: Uint8Array): boolean {
  return b.length >= 12 && u8(b[0], 0x52) && u8(b[1], 0x49) && u8(b[2], 0x46) && u8(b[3], 0x46)
    && u8(b[8], 0x57) && u8(b[9], 0x45) && u8(b[10], 0x42) && u8(b[11], 0x50);
}

/** Detect the container from magic bytes. */
function detect(b: Uint8Array): StripResult['format'] {
  if (isJpeg(b)) return 'jpeg';
  if (isPng(b)) return 'png';
  if (isWebp(b)) return 'webp';
  return 'unsupported';
}

/** Strip metadata from in-memory file bytes. Pure + synchronous so it is trivial to unit-test. Unsupported formats return the input untouched with `stripped: false`. */
export function stripMetadataBytes(input: Uint8Array): StripResult {
  const format = detect(input);
  try {
    if (format === 'jpeg') return { bytes: stripJpeg(input), stripped: true, format };
    if (format === 'png') return { bytes: stripPng(input), stripped: true, format };
    if (format === 'webp') return { bytes: stripWebp(input), stripped: true, format };
  } catch {
    /** Never block a send because of a malformed container: fall back to the original bytes and report not-stripped so callers stay honest. */
    return { bytes: input, stripped: false, format };
  }
  return { bytes: input, stripped: false, format };
}

/** MIME types we can strip. */
const STRIPPABLE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
/** File extensions we can strip. */
const STRIPPABLE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp']);

/** Whether a given MIME / filename names a raster image format we can strip. Lets the send path skip reading bytes for files we know we cannot sanitise. */
export function isStrippableImage(mimeType: string | undefined, filename: string | undefined): boolean {
  if (STRIPPABLE_MIMES.has((mimeType ?? '').toLowerCase())) return true;
  const ext = (filename ?? '').split('.').pop()?.toLowerCase() ?? '';
  return STRIPPABLE_EXTS.has(ext);
}
