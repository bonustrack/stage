export const ATTACHMENT_MAX_WIDTH = 400;
export const ATTACHMENT_GRID_GAP = 4;

interface ImageSize { width: number; height: number }

export function validSize(size: { width?: number; height?: number } | undefined): ImageSize | undefined {
  const width = size?.width;
  const height = size?.height;
  if (width === undefined || height === undefined) return undefined;
  return width > 0 && height > 0 ? { width, height } : undefined;
}

export function attachmentCellWidths(kinds: readonly string[]): ('50%' | '100%')[] {
  const squares = kinds.filter(kind => kind !== 'audio').length;
  return kinds.map(kind => (kind === 'audio' || squares < 2 ? '100%' : '50%'));
}
