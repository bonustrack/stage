import { PROXY_ROUTES } from '@stage-labs/client/endpoints';
import type { LinkPreview } from '@stage-labs/client/api/linkPreview';

const IMAGE_WIDTH = 600;
const FAVICON_WIDTH = 64;

function imgUrl(origin: string, target: string, width: number): string {
  return `${origin}${PROXY_ROUTES.img}?url=${encodeURIComponent(target)}&w=${width}`;
}

export function proxyPreviewImages(meta: LinkPreview, selfOrigin: string): LinkPreview {
  const out: LinkPreview = { ...meta };
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
