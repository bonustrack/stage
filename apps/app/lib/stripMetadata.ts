/** Force-strip embedded metadata from outbound files before they are encrypted
 *  and uploaded. Photos are the main privacy leak: phone cameras embed GPS
 *  coordinates, capture timestamps, device model + serial, and lens info as EXIF
 *  inside the JPEG/HEIC bytes; PNG/WebP screenshots can carry XMP, text chunks
 *  and timestamps. We re-write the container BYTE STREAM in pure JS - no native
 *  module, no re-encode, no quality loss - dropping every metadata-bearing
 *  segment while keeping the pixels intact.
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

const u8 = (a: number, b: number): boolean => a === b;

/** JPEG: SOI (FFD8) then a sequence of marker segments. We copy the stream and
 *  drop the APPn application markers that carry metadata (APP1=EXIF/XMP,
 *  APP2=ICC, APP13=IPTC/Photoshop, APP0=JFIF is harmless and kept) plus COM
 *  comment markers. Everything from SOS (FFDA) onward is entropy-coded scan
 *  data and is copied verbatim. */
function stripJpeg(b: Uint8Array): Uint8Array {
  const out: number[] = [0xff, 0xd8];
  let i = 2;
  while (i + 1 < b.length) {
    if (b[i] !== 0xff) { // resync defensively; copy byte
      out.push(b[i]); i += 1; continue;
    }
    const marker = b[i + 1];
    // Standalone markers without a length payload (RSTn, SOI, EOI, TEM).
    if (marker === 0xd9) { out.push(0xff, 0xd9); break; } // EOI
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(0xff, marker); i += 2; continue;
    }
    // Start of scan: copy the rest of the file unchanged (scan data).
    if (marker === 0xda) {
      for (let j = i; j < b.length; j += 1) out.push(b[j]);
      break;
    }
    const len = (b[i + 2] << 8) | b[i + 3]; // segment length incl. these 2 bytes
    const dropApp = marker >= 0xe1 && marker <= 0xef; // APP1..APP15 (keep APP0 JFIF)
    const dropCom = marker === 0xfe; // COM comment
    if (!dropApp && !dropCom) {
      for (let j = i; j < i + 2 + len; j += 1) out.push(b[j]);
    }
    i += 2 + len;
  }
  return Uint8Array.from(out);
}

/** PNG: 8-byte signature then length-prefixed chunks. We drop ancillary chunks
 *  that carry metadata (tEXt/zTXt/iTXt text, tIME timestamp, eXIf EXIF) and copy
 *  every other chunk (IHDR, PLTE, IDAT, IEND, color/gamma rendering chunks)
 *  verbatim, including their original CRCs. */
const PNG_DROP = new Set(['tEXt', 'zTXt', 'iTXt', 'tIME', 'eXIf']);
function stripPng(b: Uint8Array): Uint8Array {
  const out: number[] = [];
  for (let k = 0; k < 8; k += 1) out.push(b[k]); // signature
  let i = 8;
  while (i + 8 <= b.length) {
    const len = (b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3];
    const type = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
    const total = 12 + len; // length(4) + type(4) + data(len) + crc(4)
    if (i + total > b.length) break; // truncated; stop
    if (!PNG_DROP.has(type)) {
      for (let j = i; j < i + total; j += 1) out.push(b[j]);
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
  const head = Array.from(b.slice(0, 12)); // 'RIFF' size 'WEBP'
  const body: number[] = [];
  let i = 12;
  while (i + 8 <= b.length) {
    const fourcc = String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
    const size = b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24);
    const padded = size + (size & 1); // chunks are padded to even length
    const total = 8 + padded;
    if (i + total > b.length) break;
    if (fourcc !== 'EXIF' && fourcc !== 'XMP ') {
      const chunk = Array.from(b.slice(i, i + total));
      if (fourcc === 'VP8X') chunk[8] &= ~0b00001100; // clear EXIF(0x08)+XMP(0x04) flags
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
