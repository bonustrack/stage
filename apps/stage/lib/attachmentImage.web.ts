const MAX_EDGE = 1920;
const SCALE_LADDER = [1, 0.7, 0.5, 0.35];
const QUALITY_LADDER = [0.82, 0.65, 0.5];
const RESHAPABLE = /^image\/(jpeg|png|webp|heic|heif|bmp)$/;
const TYPE_EXT: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg' };

export interface FittedImage { bytes: Uint8Array; mimeType: string }

let cachedEncodeType: string | null = null;

function encodeType(): string {
  if (cachedEncodeType !== null) return cachedEncodeType;
  const probe = document.createElement('canvas');
  probe.width = 1;
  probe.height = 1;
  cachedEncodeType = probe.toDataURL('image/webp').startsWith('data:image/webp')
    ? 'image/webp'
    : 'image/jpeg';
  return cachedEncodeType;
}

export function retypeFilename(filename: string, mimeType: string): string {
  const ext = TYPE_EXT[mimeType];
  if (ext === undefined) return filename;
  const dot = filename.lastIndexOf('.');
  return `${dot > 0 ? filename.slice(0, dot) : filename}.${ext}`;
}

function drawScaled(bitmap: ImageBitmap, scale: number): HTMLCanvasElement {
  const longest = Math.max(bitmap.width, bitmap.height);
  const factor = (longest > MAX_EDGE ? MAX_EDGE / longest : 1) * scale;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * factor));
  canvas.height = Math.max(1, Math.round(bitmap.height * factor));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2d context unavailable');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function encodeCanvas(
  canvas: HTMLCanvasElement, type: string, quality: number,
): Promise<Uint8Array | null> {
  const blob = await new Promise<Blob | null>(resolve => { canvas.toBlob(resolve, type, quality); });
  if (blob?.type !== type) return null;
  return new Uint8Array(await blob.arrayBuffer());
}

async function reencodeUnder(
  bitmap: ImageBitmap, original: FittedImage, limit: number,
): Promise<FittedImage> {
  const type = encodeType();
  let best = original;
  for (const scale of SCALE_LADDER) {
    const canvas = drawScaled(bitmap, scale);
    for (const quality of QUALITY_LADDER) {
      const out = await encodeCanvas(canvas, type, quality);
      if (out === null) return best;
      if (out.byteLength <= limit) return { bytes: out, mimeType: type };
      if (out.byteLength < best.bytes.byteLength) best = { bytes: out, mimeType: type };
    }
  }
  return best;
}

export async function shrinkImageForUpload(
  bytes: Uint8Array, mimeType: string, limit: number,
): Promise<FittedImage> {
  const original: FittedImage = { bytes, mimeType };
  if (bytes.byteLength <= limit || !RESHAPABLE.test(mimeType)) return original;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([bytes.slice().buffer], { type: mimeType }));
  } catch {
    return original;
  }
  try {
    return await reencodeUnder(bitmap, original, limit);
  } catch {
    return original;
  } finally {
    bitmap.close();
  }
}
