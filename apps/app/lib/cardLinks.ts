


import { youtubeIdOf, mapCoordsOf } from './embedDetect';
import { githubLinkOf } from './githubDetect';
import { previewLinkOf } from './previewLinkDetect';
import { isGenericLink } from './genericLinkDetect';
import { metroConvIdOf, metroDmPeerOf } from '@stage-labs/client/xmtp/line';

export const MAX_CARDS = 5;

export type CardLink =
  | { kind: 'dm'; url: string; peerAddress: string }
  | { kind: 'channel'; url: string; convId: string }
  | { kind: 'youtube'; url: string; videoId: string }
  | { kind: 'map'; url: string; lat: number; lng: number; sourceUrl: string }
  | { kind: 'github'; url: string }
  | { kind: 'preview'; url: string }
  | { kind: 'generic'; url: string };

const TOKEN_RE = /(?:https?:\/\/|metro:\/\/|stage:\/\/)\S+/gi;

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

  const clean = token.replace(/[.,;:!?)\]}'"]+$/, '');
  if (isGenericLink(clean)) return { kind: 'generic', url: clean };

  return null;
}

function isBracketWrapped(text: string, token: string, start: number): boolean {
  if (text[start - 1] !== '<') return false;
  const after = text[start + token.length];
  return token.endsWith('>') || after === '>';
}

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
