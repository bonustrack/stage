/** @file Classifies a message-body http(s) URL as a "generic" link (one not claimed by a more-specific card detector) so it gets an OpenGraph preview card. */

import { youtubeIdOf, mapCoordsOf } from './embedDetect';
import { githubLinkOf } from './githubDetect';
import { previewLinkOf } from './previewLinkDetect';
import { metroConvIdOf, metroDmPeerOf } from '@stage-labs/client/xmtp/line';

/** Detectors that claim a URL as a more-specific card; any match disqualifies a generic preview. */
const SPECIFIC_DETECTORS: ((t: string) => unknown)[] = [
  metroDmPeerOf,
  metroConvIdOf,
  youtubeIdOf,
  mapCoordsOf,
  githubLinkOf,
  previewLinkOf,
];

/** True when `token` parses as an http(s) URL with a host. */
function isWebUrlWithHost(token: string): boolean {
  try {
    const u = new URL(token);
    return !!u.hostname && (u.protocol === 'http:' || u.protocol === 'https:');
  } catch {
    return false;
  }
}

/** True when `token` is a plain http(s) link with no more-specific card. The checks mirror cardLinks.ts `classify` precedence so a URL is never rendered as both a special card and a generic preview. */
export function isGenericLink(token: string): boolean {
  if (!/^https?:\/\//i.test(token)) return false; /** only web links (not metro://) */
  if (SPECIFIC_DETECTORS.some(detect => detect(token))) return false;
  return isWebUrlWithHost(token);
}

/** The bare hostname (minus a leading www.) of a link, for the card's domain line. Returns the raw url on parse failure. */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
