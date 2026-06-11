/** Multi-link card detection for message bubbles.
 *
 *  A single message body can contain several links that each render their own
 *  rich card: a metro channel/DM deep link, a GitHub repo/PR/issue link, an EAS
 *  preview-build deep link, a YouTube link, or a map link. The bubble renders one
 *  card per detected link, stacked below the text in order of appearance.
 *
 *  This helper scans the body for every URL-shaped token, classifies each via the
 *  existing per-detector functions, dedupes identical URLs, and caps the result so
 *  a link-heavy message can't spawn an unbounded number of cards. Pure string
 *  parsing - no network - so it stays cheap on every render and unit-testable. */

import { youtubeIdOf, mapCoordsOf } from './embedDetect';
import { githubLinkOf } from './githubDetect';
import { previewLinkOf } from './previewLinkDetect';
import { isGenericLink } from './genericLinkDetect';
import { metroConvIdOf, metroDmPeerOf } from '@stage-labs/client/xmtp/line';

/** Maximum number of cards rendered per message. Extra links beyond this stay as
 *  plain tappable text (no card) to bound render cost on link-dump messages. */
export const MAX_CARDS = 5;

export type CardLink =
  | { kind: 'dm'; url: string; peerAddress: string }
  | { kind: 'channel'; url: string; convId: string }
  | { kind: 'youtube'; url: string; videoId: string }
  | { kind: 'map'; url: string; lat: number; lng: number; sourceUrl: string }
  | { kind: 'github'; url: string }
  | { kind: 'preview'; url: string }
  | { kind: 'generic'; url: string };

/** A URL-shaped token: an http(s) link or a `metro://` / `stage://` deep link
 *  (the app ships under both brands), terminated by whitespace. Matched globally
 *  so we can walk every link in appearance order. */
const TOKEN_RE = /(?:https?:\/\/|metro:\/\/|stage:\/\/)\S+/gi;

/** Classify a single URL token into a card descriptor, or null if it isn't a
 *  card-generating link. The detectors are run against the lone token (not the
 *  whole body) so each card maps to exactly one link.
 *
 *  Order mirrors the original single-card precedence: DM before channel (the
 *  `user/<addr>` form must not be read as a conv id), then media embeds, then
 *  GitHub, then the generic preview deep link. */
function classify(token: string): CardLink | null {
  const dmPeer = metroDmPeerOf(token);
  if (dmPeer) return { kind: 'dm', url: token, peerAddress: dmPeer };

  const convId = metroConvIdOf(token);
  if (convId) return { kind: 'channel', url: token, convId };

  const videoId = youtubeIdOf(token);
  if (videoId) return { kind: 'youtube', url: token, videoId };

  const coords = mapCoordsOf(token);
  if (coords) {
    return { kind: 'map', url: coords.sourceUrl, lat: coords.lat, lng: coords.lng, sourceUrl: coords.sourceUrl };
  }

  const gh = githubLinkOf(token);
  if (gh) return { kind: 'github', url: gh.url };

  const preview = previewLinkOf(token);
  if (preview) return { kind: 'preview', url: preview.url };

  // Any other plain http(s) link gets a generic OpenGraph preview card. Strip
  // trailing sentence punctuation the greedy token match may have swallowed.
  const clean = token.replace(/[.,;:!?)\]}'"]+$/, '');
  if (isGenericLink(clean)) return { kind: 'generic', url: clean };

  return null;
}

/** Extract every card-generating link from `text`, in order of appearance,
 *  deduped by the canonical card url, capped at {@link MAX_CARDS}. Returns an
 *  empty array when the body has no card links. */
export function cardLinksOf(text?: string | null): CardLink[] {
  if (!text) return [];
  const out: CardLink[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(TOKEN_RE)) {
    const card = classify(m[0]);
    if (!card) continue;
    if (seen.has(card.url)) continue;
    seen.add(card.url);
    out.push(card);
    if (out.length >= MAX_CARDS) break;
  }
  return out;
}
