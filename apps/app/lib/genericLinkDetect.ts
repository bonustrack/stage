
import { youtubeIdOf, mapCoordsOf } from '@stage-labs/client/embed/detect';
import { githubLinkOf } from '@stage-labs/client/api/github';
import { previewLinkOf } from './previewLinkDetect';
import { metroConvIdOf, metroDmPeerOf } from '@stage-labs/client/xmtp/line';

const SPECIFIC_DETECTORS: ((t: string) => unknown)[] = [
  metroDmPeerOf,
  metroConvIdOf,
  youtubeIdOf,
  mapCoordsOf,
  githubLinkOf,
  previewLinkOf,
];

function isWebUrlWithHost(token: string): boolean {
  try {
    const u = new URL(token);
    return !!u.hostname && (u.protocol === 'http:' || u.protocol === 'https:');
  } catch {
    return false;
  }
}

export function isGenericLink(token: string): boolean {
  if (!/^https?:\/\//i.test(token)) return false;
  if (SPECIFIC_DETECTORS.some(detect => detect(token))) return false;
  return isWebUrlWithHost(token);
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
