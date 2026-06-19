/** @file Classifies a message-body http(s) URL as a "generic" link (one not claimed by a more-specific card detector) so it gets an OpenGraph preview card. */

import { youtubeIdOf, mapCoordsOf } from './embedDetect';
import { githubLinkOf } from './githubDetect';
import { previewLinkOf } from './previewLinkDetect';
import { metroConvIdOf, metroDmPeerOf } from '@stage-labs/client/xmtp/line';

/** True when `token` is a plain http(s) link with no more-specific card. The checks mirror cardLinks.ts `classify` precedence so a URL is never rendered as both a special card and a generic preview. */
export function isGenericLink(token: string): boolean {
  if (!/^https?:\/\//i.test(token)) return false; // only web links (not metro://)
  if (metroDmPeerOf(token)) return false;
  if (metroConvIdOf(token)) return false;
  if (youtubeIdOf(token)) return false;
  if (mapCoordsOf(token)) return false;
  if (githubLinkOf(token)) return false;
  if (previewLinkOf(token)) return false;
  // Validate it actually parses as a URL with a host.
  try {
    const u = new URL(token);
    return !!u.hostname && (u.protocol === 'http:' || u.protocol === 'https:');
  } catch {
    return false;
  }
}

/** Leading `www.` stripped off a hostname for the domain line. Hoisted to module scope so it is compiled once, not on every {@link domainOf} call (domainOf runs in non-memoized card render bodies). */
const WWW_RE = /^www\./;

/** The bare hostname (minus a leading www.) of a link, for the card's domain line. Returns the raw url on parse failure. */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(WWW_RE, '');
  } catch {
    return url;
  }
}
