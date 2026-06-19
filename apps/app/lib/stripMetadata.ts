/** Force-strip embedded metadata from outbound files before they are encrypted
 *  and uploaded. Photos are the main privacy leak: phone cameras embed GPS
 *  coordinates, capture timestamps, device model + serial, and lens info as EXIF
 *  inside the JPEG/HEIC bytes; PNG/WebP screenshots can carry XMP, text chunks
 *  and timestamps. We re-write the container BYTE STREAM in pure JS - no native
 *  module, no re-encode, no quality loss - dropping every metadata-bearing
 *  segment while keeping the pixels intact. For JPEG this means NO residual EXIF
 *  (APP1) and NO ICC profile (APP2): the ONLY thing that may survive is a
 *  rebuilt, orientation-only EXIF (a non-sensitive 1..8 display hint) so photos
 *  still render the right way up without a pixel re-encode. See stripJpeg.
 *
 *  Why not expo-image-manipulator: it is a native config-plugin module (not in
 *  this app's deps) so adopting it would require a new APK, and it still only
 *  covers raster images. This byte-level stripper needs zero native code, runs
 *  in the JS test env, and is applied unconditionally in the send path so EVERY
 *  image send is sanitised.
 *
 *  Honest scope: this strips JPEG / PNG / WebP metadata losslessly. Formats we
 *  cannot safely rewrite on-device without a heavy codec (HEIC/HEIF, video
 *  containers like MP4/MOV, PDF/Office docs) are passed through UNCHANGED and
 *  reported by `wasStripped()` as false, so callers never assume a file is clean
 *  when it is not. See the PR for the ffmpeg/APK follow-up needed for video. */

/** A metadata-strip outcome. `bytes` is always safe to send; when `stripped` is
 *  false the original bytes are returned unchanged (unsupported format) and the
 *  caller knows residual metadata MAY remain. */
export interface StripResult {
  bytes: Uint8Array;
  /** True only when we actively rewrote the container and removed metadata
   *  segments (or confirmed there were none in a format we fully control). */
  stripped: boolean;
  /** Detected container, for logging/telemetry. */
  format: 'jpeg' | 'png' | 'webp' | 'unsupported';
}

/** U8 helper. */
const u8 = (a: number | undefined, b: number): boolean => a === b;

/** Read the EXIF Orientation tag (TIFF tag 0x0112) out of a JPEG APP1 payload.
 *  Returns the 1..8 value, or undefined if absent / unparseable / the default 1.
 *  Orientation is the ONE tag worth preserving: it is not a privacy leak (just a
 *  display-rotation hint, 1..8) and dropping it would make some camera photos
 *  show up rotated, because a lossless container rewrite cannot re-bake pixels.
 *  We parse only IFD0 (the rotation lives there); we never follow the Exif/GPS
 *  sub-IFD pointers, so no other tag is ever read or kept. */
function readJpegOrientation(payload: Uint8Array): number | undefined {
  // Bounds-guarded byte read; out-of-range bytes read as 0 (every call below is
  // already length-checked, so this only satisfies noUncheckedIndexedAccess).
  /** At helper. */
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
  const ifd0 = tiff + u32(tiff + 4);
  if (ifd0 + 2 > payload.length) return undefined;
  const count = u16(ifd0);
  for (let k = 0; k < count; k += 1) {
    const entry = ifd0 + 2 + k * 12;
    if (entry + 12 > payload.length) break;
    if (u16(entry) === 0x0112) { // Orientation
      const v = u16(entry + 8); // SHORT value sits in the value field
      return v >= 1 && v <= 8 ? v : undefined;
    }
  }
  return undefined;
}

/** Build a minimal APP1 EXIF segment carrying ONLY the Orientation tag. Little-
 *  endian TIFF, single IFD0 entry, no sub-IFDs, no thumbnail. ~26 bytes - it
 *  cannot encode GPS, camera make/model, timestamps, LightSource or any other
 *  leak because we literally do not write those entries. */
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

/** JPEG: SOI (FFD8) then a sequence of marker segments. We DROP every metadata-
 *  bearing application marker - APP1 (EXIF/XMP), APP2 (ICC_PROFILE), APP13
 *  (IPTC/Photoshop) and all APP3..APP15 - plus COM comments, leaving NO residual
 *  EXIF or ICC. APP0 (JFIF) is harmless and kept. Everything from SOS (FFDA)
 *  onward is entropy-coded scan data and is copied verbatim.
 *
 *  Orientation handling (lossless, approach a): before dropping APP1 we read its
 *  Orientation value. If it is non-default (2..8) we re-emit a MINIMAL APP1 that
 *  carries ONLY that tag, so the photo still displays the right way up without a
 *  pixel re-encode (which would need a native codec / new APK). Orientation is
 *  not sensitive (1..8). Every other EXIF/GPS/ICC byte is gone. */
function stripJpeg(b: Uint8Array): Uint8Array {
  /** At helper. */
  const at = (o: number): number => b[o] ?? 0;
  const out: number[] = [0xff, 0xd8];
  let orientation: number | undefined;
  let i = 2;
  while (i + 1 < b.length) {
    if (at(i) !== 0xff) { // resync defensively; copy byte
      out.push(at(i)); i += 1; continue;
    }
    const marker = at(i + 1);
    // Standalone markers without a length payload (RSTn, SOI, EOI, TEM).
    if (marker === 0xd9) { out.push(0xff, 0xd9); break; } // EOI
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(0xff, marker); i += 2; continue;
    }
    // Start of scan: copy the rest of the file unchanged (scan data).
    if (marker === 0xda) {
      for (let j = i; j < b.length; j += 1) out.push(at(j));
      break;
    }
    const len = (at(i + 2) << 8) | at(i + 3); // segment length incl. these 2 bytes
    const isApp1 = marker === 0xe1;
    const dropApp = marker >= 0xe1 && marker <= 0xef; // APP1..APP15 (keep APP0 JFIF)
    const dropCom = marker === 0xfe; // COM comment
    if (isApp1) {
      const payload = b.subarray(i + 4, i + 2 + len);
      orientation = orientation ?? readJpegOrientation(payload); // capture before dropping
    }
    if (!dropApp && !dropCom) {
      for (let j = i; j < i + 2 + len; j += 1) out.push(at(j));
    }
    i += 2 + len;
  }
  // Re-insert an orientation-only EXIF right after SOI when rotation is non-default.
  if (orientation !== undefined && orientation !== 1) {
    out.splice(2, 0, ...buildOrientationApp1(orientation));
  }
  return Uint8Array.from(out);
}

/** PNG: 8-byte signature then length-prefixed chunks. We drop ancillary chunks
 *  that carry metadata (tEXt/zTXt/iTXt text, tIME timestamp, eXIf EXIF) and copy
 *  every other chunk (IHDR, PLTE, IDAT, IEND, color/gamma rendering chunks)
 *  verbatim, including their original CRCs. */
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

/** WebP: RIFF container. Drop the `EXIF` and `XMP ` chunks; copy VP8/VP8L/VP8X/
 *  ALPH/ANIM/ANMF chunks. Fix up the RIFF size header to match the new payload.
 *  (We also clear the EXIF/XMP flag bits in a VP8X header so decoders don't look
 *  for chunks we removed.) */
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

/** Detect the container from magic bytes. */
function detect(b: Uint8Array): StripResult['format'] {
  if (b.length >= 3 && u8(b[0], 0xff) && u8(b[1], 0xd8) && u8(b[2], 0xff)) return 'jpeg';
  if (
    b.length >= 8 && u8(b[0], 0x89) && u8(b[1], 0x50) && u8(b[2], 0x4e) && u8(b[3], 0x47)
    && u8(b[4], 0x0d) && u8(b[5], 0x0a) && u8(b[6], 0x1a) && u8(b[7], 0x0a)
  ) return 'png';
  if (
    b.length >= 12 && u8(b[0], 0x52) && u8(b[1], 0x49) && u8(b[2], 0x46) && u8(b[3], 0x46)
    && u8(b[8], 0x57) && u8(b[9], 0x45) && u8(b[10], 0x42) && u8(b[11], 0x50)
  ) return 'webp';
  return 'unsupported';
}

/** Strip metadata from in-memory file bytes. Pure + synchronous so it is trivial
 *  to unit-test. Unsupported formats return the input untouched with
 *  `stripped: false`. */
export function stripMetadataBytes(input: Uint8Array): StripResult {
  const format = detect(input);
  try {
    if (format === 'jpeg') return { bytes: stripJpeg(input), stripped: true, format };
    if (format === 'png') return { bytes: stripPng(input), stripped: true, format };
    if (format === 'webp') return { bytes: stripWebp(input), stripped: true, format };
  } catch {
    /** Never block a send because of a malformed container: fall back to the
     *  original bytes and report not-stripped so callers stay honest. */
    return { bytes: input, stripped: false, format };
  }
  return { bytes: input, stripped: false, format };
}

/** Whether a given MIME / filename names a raster image format we can strip. Lets
 *  the send path skip reading bytes for files we know we cannot sanitise. */
export function isStrippableImage(mimeType: string | undefined, filename: string | undefined): boolean {
  const m = (mimeType ?? '').toLowerCase();
  if (m === 'image/jpeg' || m === 'image/jpg' || m === 'image/png' || m === 'image/webp') return true;
  const ext = (filename ?? '').split('.').pop()?.toLowerCase() ?? '';
  return ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp';
}
