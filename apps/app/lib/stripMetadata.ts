
export interface StripResult {
  bytes: Uint8Array;
  stripped: boolean;
  format: 'jpeg' | 'png' | 'webp' | 'unsupported';
}

const u8 = (a: number | undefined, b: number): boolean => a === b;

interface TiffReader {
  u16: (o: number) => number;
  u32: (o: number) => number;
  tiff: number;
}

function tiffReaderFor(payload: Uint8Array): TiffReader | undefined {
  const at = (o: number): number => payload[o] ?? 0;
  if (payload.length < 6 + 8) return undefined;
  if (at(0) !== 0x45 || at(1) !== 0x78 || at(2) !== 0x69 || at(3) !== 0x66) return undefined;
  const tiff = 6;
  const le = at(tiff) === 0x49 && at(tiff + 1) === 0x49;
  const be = at(tiff) === 0x4d && at(tiff + 1) === 0x4d;
  if (!le && !be) return undefined;
  const u16 = (o: number): number => (le ? at(o) | (at(o + 1) << 8) : (at(o) << 8) | at(o + 1));
  const u32 = (o: number): number => (le
    ? at(o) | (at(o + 1) << 8) | (at(o + 2) << 16) | (at(o + 3) << 24)
    : (at(o) << 24) | (at(o + 1) << 16) | (at(o + 2) << 8) | at(o + 3));
  return { u16, u32, tiff };
}

function readJpegOrientation(payload: Uint8Array): number | undefined {
  const r = tiffReaderFor(payload);
  if (!r) return undefined;
  const ifd0 = r.tiff + r.u32(r.tiff + 4);
  if (ifd0 + 2 > payload.length) return undefined;
  const count = r.u16(ifd0);
  for (let k = 0; k < count; k += 1) {
    const entry = ifd0 + 2 + k * 12;
    if (entry + 12 > payload.length) break;
    if (r.u16(entry) === 0x0112) {
      const v = r.u16(entry + 8);
      return v >= 1 && v <= 8 ? v : undefined;
    }
  }
  return undefined;
}

function buildOrientationApp1(orientation: number): number[] {
  const tiff = [
    0x49, 0x49, 0x2a, 0x00,
    0x08, 0x00, 0x00, 0x00,
    0x01, 0x00,
    0x12, 0x01,
    0x03, 0x00,
    0x01, 0x00, 0x00, 0x00,
    orientation & 0xff, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  ];
  const payload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
  const len = payload.length + 2;
  return [0xff, 0xe1, (len >> 8) & 0xff, len & 0xff, ...payload];
}

interface JpegScan {
  out: number[];
  orientation: number | undefined;
  next: number;
}

function handleJpegSegment(b: Uint8Array, at: (o: number) => number, i: number, marker: number, s: JpegScan): void {
  const len = (at(i + 2) << 8) | at(i + 3);
  if (marker === 0xe1) {
    const payload = b.subarray(i + 4, i + 2 + len);
    s.orientation = s.orientation ?? readJpegOrientation(payload);
  }
  const dropApp = marker >= 0xe1 && marker <= 0xef;
  const dropCom = marker === 0xfe;
  if (!dropApp && !dropCom) {
    for (let j = i; j < i + 2 + len; j += 1) s.out.push(at(j));
  }
  s.next = i + 2 + len;
}

function stepJpegMarker(b: Uint8Array, at: (o: number) => number, i: number, s: JpegScan): void {
  if (at(i) !== 0xff) {
    s.out.push(at(i)); s.next = i + 1; return;
  }
  const marker = at(i + 1);
  if (marker === 0xd9) { s.out.push(0xff, 0xd9); s.next = -1; return; }
  if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
    s.out.push(0xff, marker); s.next = i + 2; return;
  }
  if (marker === 0xda) {
    for (let j = i; j < b.length; j += 1) s.out.push(at(j));
    s.next = -1; return;
  }
  handleJpegSegment(b, at, i, marker, s);
}

function stripJpeg(b: Uint8Array): Uint8Array {
  const at = (o: number): number => b[o] ?? 0;
  const s: JpegScan = { out: [0xff, 0xd8], orientation: undefined, next: 2 };
  let i = 2;
  while (i + 1 < b.length) {
    stepJpegMarker(b, at, i, s);
    if (s.next < 0) break;
    i = s.next;
  }
  if (s.orientation !== undefined && s.orientation !== 1) {
    s.out.splice(2, 0, ...buildOrientationApp1(s.orientation));
  }
  return Uint8Array.from(s.out);
}

const PNG_DROP = new Set(['tEXt', 'zTXt', 'iTXt', 'tIME', 'eXIf']);
function stripPng(b: Uint8Array): Uint8Array {
  const at = (o: number): number => b[o] ?? 0;
  const out: number[] = [];
  for (let k = 0; k < 8; k += 1) out.push(at(k));
  let i = 8;
  while (i + 8 <= b.length) {
    const len = (at(i) << 24) | (at(i + 1) << 16) | (at(i + 2) << 8) | at(i + 3);
    const type = String.fromCharCode(at(i + 4), at(i + 5), at(i + 6), at(i + 7));
    const total = 12 + len;
    if (i + total > b.length) break;
    if (!PNG_DROP.has(type)) {
      for (let j = i; j < i + total; j += 1) out.push(at(j));
    }
    i += total;
    if (type === 'IEND') break;
  }
  return Uint8Array.from(out);
}

function stripWebp(b: Uint8Array): Uint8Array {
  const at = (o: number): number => b[o] ?? 0;
  const head = Array.from(b.slice(0, 12));
  const body: number[] = [];
  let i = 12;
  while (i + 8 <= b.length) {
    const fourcc = String.fromCharCode(at(i), at(i + 1), at(i + 2), at(i + 3));
    const size = at(i + 4) | (at(i + 5) << 8) | (at(i + 6) << 16) | (at(i + 7) << 24);
    const padded = size + (size & 1);
    const total = 8 + padded;
    if (i + total > b.length) break;
    if (fourcc !== 'EXIF' && fourcc !== 'XMP ') {
      const chunk = Array.from(b.slice(i, i + total));
      if (fourcc === 'VP8X') chunk[8] = (chunk[8] ?? 0) & ~0b00001100;
      body.push(...chunk);
    }
    i += total;
  }
  const newSize = 4 + body.length;
  head[4] = newSize & 0xff;
  head[5] = (newSize >> 8) & 0xff;
  head[6] = (newSize >> 16) & 0xff;
  head[7] = (newSize >> 24) & 0xff;
  return Uint8Array.from([...head, ...body]);
}

function isJpeg(b: Uint8Array): boolean {
  return b.length >= 3 && u8(b[0], 0xff) && u8(b[1], 0xd8) && u8(b[2], 0xff);
}

function isPng(b: Uint8Array): boolean {
  return b.length >= 8 && u8(b[0], 0x89) && u8(b[1], 0x50) && u8(b[2], 0x4e) && u8(b[3], 0x47)
    && u8(b[4], 0x0d) && u8(b[5], 0x0a) && u8(b[6], 0x1a) && u8(b[7], 0x0a);
}

function isWebp(b: Uint8Array): boolean {
  return b.length >= 12 && u8(b[0], 0x52) && u8(b[1], 0x49) && u8(b[2], 0x46) && u8(b[3], 0x46)
    && u8(b[8], 0x57) && u8(b[9], 0x45) && u8(b[10], 0x42) && u8(b[11], 0x50);
}

function detect(b: Uint8Array): StripResult['format'] {
  if (isJpeg(b)) return 'jpeg';
  if (isPng(b)) return 'png';
  if (isWebp(b)) return 'webp';
  return 'unsupported';
}

export function stripMetadataBytes(input: Uint8Array): StripResult {
  const format = detect(input);
  try {
    if (format === 'jpeg') return { bytes: stripJpeg(input), stripped: true, format };
    if (format === 'png') return { bytes: stripPng(input), stripped: true, format };
    if (format === 'webp') return { bytes: stripWebp(input), stripped: true, format };
  } catch {
    return { bytes: input, stripped: false, format };
  }
  return { bytes: input, stripped: false, format };
}

const STRIPPABLE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const STRIPPABLE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp']);

export function isStrippableImage(mimeType: string | undefined, filename: string | undefined): boolean {
  if (STRIPPABLE_MIMES.has((mimeType ?? '').toLowerCase())) return true;
  const ext = (filename ?? '').split('.').pop()?.toLowerCase() ?? '';
  return STRIPPABLE_EXTS.has(ext);
}
