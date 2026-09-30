import { base64ToBytes } from '@stage-labs/client/text/base64';

interface DecodeSize { width: number; height: number; bytesPerPixel?: number }

const DRAW_LIMIT_BYTES = 100_000_000;
const WORST_BYTES_PER_PIXEL = 8;
const HEADER_BASE64_CHARS = 262_144;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_STANDALONE = new Set([0x01, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8]);
const JPEG_NOT_FRAME = new Set([0xc4, 0xc8, 0xcc]);

export function viewerResizeMethod(image: DecodeSize | undefined): 'none' | 'scale' {
  if (!image) return 'scale';
  const bytes = image.width * image.height * (image.bytesPerPixel ?? WORST_BYTES_PER_PIXEL);
  return bytes <= DRAW_LIMIT_BYTES ? 'none' : 'scale';
}

function u16(b: Uint8Array, at: number): number {
  return ((b[at] ?? 0) << 8) | (b[at + 1] ?? 0);
}

function u32(b: Uint8Array, at: number): number {
  return u16(b, at) * 0x10000 + u16(b, at + 2);
}

function pngSize(b: Uint8Array): DecodeSize | undefined {
  if (!PNG_SIGNATURE.every((byte, k) => b[k] === byte)) return undefined;
  return { width: u32(b, 16), height: u32(b, 20), bytesPerPixel: b[24] === 16 ? 8 : 4 };
}

function isJpegFrame(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && !JPEG_NOT_FRAME.has(marker);
}

function jpegSegmentLength(b: Uint8Array, at: number, marker: number): number {
  if (marker === 0xff) return 1;
  return JPEG_STANDALONE.has(marker) ? 2 : 2 + u16(b, at + 2);
}

function jpegSize(b: Uint8Array): DecodeSize | undefined {
  if (b[0] !== 0xff || b[1] !== 0xd8) return undefined;
  let at = 2;
  while (at + 9 < b.length && b[at] === 0xff) {
    const marker = b[at + 1] ?? 0;
    if (isJpegFrame(marker)) return { width: u16(b, at + 7), height: u16(b, at + 5), bytesPerPixel: 4 };
    at += jpegSegmentLength(b, at, marker);
  }
  return undefined;
}

function dataUriHead(uri: string): Uint8Array | undefined {
  const comma = uri.indexOf(',');
  if (!uri.startsWith('data:') || !uri.slice(0, comma).endsWith(';base64')) return undefined;
  const head = uri.slice(comma + 1, comma + 1 + HEADER_BASE64_CHARS);
  try {
    return base64ToBytes(head.slice(0, head.length - (head.length % 4)));
  } catch {
    return undefined;
  }
}

export function dataUriDecodeSize(uri: string): DecodeSize | undefined {
  const head = dataUriHead(uri);
  if (!head) return undefined;
  const size = pngSize(head) ?? jpegSize(head);
  return size && size.width > 0 && size.height > 0 ? size : undefined;
}
