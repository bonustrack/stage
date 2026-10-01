export const ATTACHMENT_MAX_WIDTH = 400;
export const ATTACHMENT_MAX_HEIGHT = 400;
export const ATTACHMENT_GAP = 4;
export const VIDEO_PLACEHOLDER_RATIO = 16 / 9;

interface ImageSize { width: number; height: number }

export function validSize(size: { width?: number; height?: number } | undefined): ImageSize | undefined {
  const width = size?.width;
  const height = size?.height;
  if (width === undefined || height === undefined) return undefined;
  return width > 0 && height > 0 ? { width, height } : undefined;
}

export function mediaAspectRatio(size: { width?: number; height?: number } | undefined, fallback = 1): number {
  const measured = validSize(size);
  return measured ? measured.width / measured.height : fallback;
}

export function mediaMaxWidth(aspectRatio: number): number {
  return ATTACHMENT_MAX_HEIGHT * aspectRatio;
}
