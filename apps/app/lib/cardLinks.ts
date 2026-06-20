/** @file Multi-link card detection: scans a message body for every URL-shaped token and classifies each into a rich-card descriptor (DM, channel, YouTube, map, GitHub, preview, generic), deduped and capped. */

/** A message body can contain several links that each render their own rich card (channel/DM, GitHub, preview, YouTube, map), one card per link in appearance order. */

/** Pure string parsing (no network): scans for every URL-shaped token, classifies via the per-detector functions, dedupes URLs, and caps the result so a link-heavy message can't spawn unbounded cards. */

import { youtubeIdOf, mapCoordsOf } from './embedDetect';
import { githubLinkOf } from './githubDetect';
import { previewLinkOf } from './previewLinkDetect';
import { isGenericLink } from './genericLinkDetect';
import { metroConvIdOf, metroDmPeerOf } from '@stage-labs/client/xmtp/line';

/** Maximum number of cards rendered per message. Extra links beyond this stay as plain tappable text (no card) to bound render cost on link-dump messages. */
export const MAX_CARDS = 5;

export type CardLink =
  | { kind: 'dm'; url: string; peerAddress: string }
  | { kind: 'channel'; url: string; convId: string }
  | { kind: 'youtube'; url: string; videoId: string }
  | { kind: 'map'; url: string; lat: number; lng: number; sourceUrl: string }
  | { kind: 'github'; url: string }
  | { kind: 'preview'; url: string }
  | { kind: 'generic'; url: string };

/** A URL-shaped token: an http(s) link or a `metro://` / `stage://` deep link (the app ships under both brands), terminated by whitespace. Matched globally so we can walk every link in appearance order. */
const TOKEN_RE = /(?:https?:\/\/|metro:\/\/|stage:\/\/)\S+/gi;

/** Classify a single URL token into a card descriptor (or null), running detectors against the lone token in precedence order: DM before channel, then media, GitHub, preview, generic. */
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

  /** Any other plain http(s) link gets a generic OpenGraph preview card, after stripping trailing sentence punctuation the greedy match may have swallowed. */
  const clean = token.replace(/[.,;:!?)\]}'"]+$/, '');
  if (isGenericLink(clean)) return { kind: 'generic', url: clean };

  return null;
}

/** True when the URL token is angle-bracket wrapped (`<https://...>`, the Discord/Slack no-preview convention), accepting a `>` after or as the token's last char paired with a preceding `<`. */
function isBracketWrapped(text: string, token: string, start: number): boolean {
  if (text[start - 1] !== '<') return false;
  const after = text[start + token.length];
  return token.endsWith('>') || after === '>';
}

/** Extract every card-generating link from `text` in appearance order, deduped by canonical url and capped at {@link MAX_CARDS}; angle-bracket-wrapped links are skipped. */
export function cardLinksOf(text?: string | null): CardLink[] {
  if (!text) return [];
  const out: CardLink[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(TOKEN_RE)) {
    if (isBracketWrapped(text, m[0], m.index)) continue;
    const card = classify(m[0]);
    if (!card) continue;
    if (seen.has(card.url)) continue;
    seen.add(card.url);
    out.push(card);
    if (out.length >= MAX_CARDS) break;
  }
  return out;
}
