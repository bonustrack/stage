/**
 * @file Rewrites a preview payload's og:image and favicon to Worker /img proxy URLs (keeping originals as imageOrigin/faviconOrigin) so the app never beacons the reader's IP to origin sites.
 */

import type { PreviewMeta } from './parse.ts';

const IMAGE_WIDTH = 600;
const FAVICON_WIDTH = 64;

/** Build a /img proxy URL on this Worker's own origin for `target`. */
function imgUrl(origin: string, target: string, width: number): string {
  return `${origin}/img?url=${encodeURIComponent(target)}&w=${width}`;
}

export interface ProxiedPreview extends PreviewMeta {
  imageOrigin?: string;
  faviconOrigin?: string;
}

/** Rewrite image + favicon to proxied /img URLs (w: image 600, favicon 64), keeping the originals as imageOrigin / faviconOrigin. `selfOrigin` is the Worker's own origin (e.g. https://preview.metro.box). */
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
