
import type { PreviewMeta } from './parse.ts';

const IMAGE_WIDTH = 600;
const FAVICON_WIDTH = 64;

function imgUrl(origin: string, target: string, width: number): string {
  return `${origin}/img?url=${encodeURIComponent(target)}&w=${width}`;
}

export interface ProxiedPreview extends PreviewMeta {
  imageOrigin?: string;
  faviconOrigin?: string;
}

export function proxyPreviewImages(meta: PreviewMeta, selfOrigin: string): ProxiedPreview {
  const out: ProxiedPreview = { ...meta };
  if (meta.image) {
    out.imageOrigin = meta.image;
    out.image = imgUrl(selfOrigin, meta.image, IMAGE_WIDTH);
  }
  if (meta.favicon) {
    out.faviconOrigin = meta.favicon;
    out.favicon = imgUrl(selfOrigin, meta.favicon, FAVICON_WIDTH);
  }
  return out;
}
