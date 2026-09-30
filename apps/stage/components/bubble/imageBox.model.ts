export const ATTACHMENT_MAX_WIDTH = 400;
export const ATTACHMENT_GRID_GAP = 4;

interface ImageSize { width: number; height: number }

export function validSize(size: { width?: number; height?: number } | undefined): ImageSize | undefined {
  const width = size?.width;
  const height = size?.height;
  if (width === undefined || height === undefined) return undefined;
  return width > 0 && height > 0 ? { width, height } : undefined;
}

export function imageAspectRatio(size: { width?: number; height?: number } | undefined): number {
  const measured = validSize(size);
  return measured ? measured.width / measured.height : 1;
}

export function imagePreviewSize(aspectRatio: number, maxSide: number): ImageSize {
  return { width: maxSide * Math.min(1, aspectRatio), height: maxSide / Math.max(1, aspectRatio) };
}

export function attachmentCellWidths(kinds: readonly string[]): ('50%' | '100%')[] {
  const squares = kinds.filter(kind => kind !== 'audio' && kind !== 'file').length;
  return kinds.map(kind => (kind === 'audio' || kind === 'file' || squares < 2 ? '100%' : '50%'));
}
