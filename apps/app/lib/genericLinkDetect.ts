/** Generic http(s) link detection for message bubbles.
 *
 *  A "generic" link is any http(s) URL in a message body that ISN'T already
 *  claimed by a more specific card detector (metro DM/channel deep link, YouTube,
 *  map, GitHub, or the EAS preview launcher — see lib/cardLinks.ts). Those keep
 *  their bespoke cards; everything else gets a generic OpenGraph preview card
 *  rendered from metadata fetched via the link-preview proxy.
 *
 *  This module only does the *classification* (is this a plain link?) — the
 *  metadata fetch lives in lib/useLinkPreview.ts so this stays pure + testable. */

import { youtubeIdOf, mapCoordsOf } from './embedDetect';
import { githubLinkOf } from './githubDetect';
import { previewLinkOf } from './previewLinkDetect';
import { metroConvIdOf, metroDmPeerOf } from '@stage-labs/client/xmtp/line';

/** True when `token` is a plain http(s) link with no more-specific card. The
 *  checks mirror cardLinks.ts `classify` precedence so a URL is never rendered
 *  as both a special card and a generic preview. */
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

/** The bare hostname (minus a leading www.) of a link, for the card's domain
 *  line. Returns the raw url on parse failure. */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
