const IMAGE_BOX_MAX = 300;

export interface ImageSize { width: number; height: number }

interface ImageBox extends ImageSize { aspectRatio: number }

export function validSize(size: { width?: number; height?: number } | undefined): ImageSize | undefined {
  const width = size?.width;
  const height = size?.height;
  if (width === undefined || height === undefined) return undefined;
  return width > 0 && height > 0 ? { width, height } : undefined;
}

export function imageBox(natural: ImageSize | undefined, max = IMAGE_BOX_MAX): ImageBox {
  if (!natural) return { width: max, height: max, aspectRatio: 1 };
  const scale = Math.min(max / natural.width, max / natural.height, 1);
  return {
    width: Math.max(1, Math.round(natural.width * scale)),
    height: Math.max(1, Math.round(natural.height * scale)),
    aspectRatio: natural.width / natural.height,
  };
}

export function sameSize(a: ImageSize | undefined, b: ImageSize): boolean {
  return a?.width === b.width && a.height === b.height;
}
