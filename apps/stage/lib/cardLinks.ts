import { youtubeIdOf, mapCoordsOf } from '@stage-labs/client/embed/detect';
import { githubLinkOf } from '@stage-labs/client/api/github';
import { stageConvIdOf, stageDmPeerOf } from '@stage-labs/client/xmtp/line';

export const MAX_CARDS = 5;

export type CardLink =
  | { kind: 'dm'; url: string; peerAddress: string }
  | { kind: 'channel'; url: string; convId: string }
  | { kind: 'youtube'; url: string; videoId: string }
  | { kind: 'map'; url: string; lat: number; lng: number; sourceUrl: string }
  | { kind: 'github'; url: string }
  | { kind: 'preview'; url: string }
  | { kind: 'generic'; url: string };

interface PreviewLinkRef {
  url: string;
  groupId: string;
  shortGroup: string;
}

const PREVIEW_RE =
  /(?:(?:metro|stage):\/\/expo-development-client\/\?url=|https?:\/\/stage\.box\/preview-launcher\.html\?u=)(\S+)/i;

export function previewLinkOf(text?: string | null): PreviewLinkRef | null {
  if (!text) return null;
  const m = PREVIEW_RE.exec(text);
  if (!m) return null;
  const url = m[0];
  const rawInner = m[1];
  if (rawInner === undefined) return null;
  let inner = rawInner;
  try {
    inner = decodeURIComponent(rawInner);
  } catch {
  }
  const g = /u\.expo\.dev\/[^/\s]+\/group\/([A-Za-z0-9-]+)/i.exec(inner);
  if (!g) return null;
  const groupId = g[1];
  if (groupId === undefined) return null;
  return { url, groupId, shortGroup: groupId.slice(0, 8) };
}

const TOKEN_RE = /(?:https?:\/\/|metro:\/\/|stage:\/\/)\S+/gi;

type Detector = (token: string) => CardLink | null;

const DETECTORS: Detector[] = [
  token => {
    const peerAddress = stageDmPeerOf(token);
    return peerAddress ? { kind: 'dm', url: token, peerAddress } : null;
  },
  token => {
    const convId = stageConvIdOf(token);
    return convId ? { kind: 'channel', url: token, convId } : null;
  },
  token => {
    const videoId = youtubeIdOf(token);
    return videoId ? { kind: 'youtube', url: token, videoId } : null;
  },
  token => {
    const coords = mapCoordsOf(token);
    return coords
      ? { kind: 'map', url: coords.sourceUrl, lat: coords.lat, lng: coords.lng, sourceUrl: coords.sourceUrl }
      : null;
  },
  token => {
    const gh = githubLinkOf(token);
    return gh ? { kind: 'github', url: gh.url } : null;
  },
  token => {
    const preview = previewLinkOf(token);
    return preview ? { kind: 'preview', url: preview.url } : null;
  },
];

function specificCard(token: string): CardLink | null {
  for (const detect of DETECTORS) {
    const card = detect(token);
    if (card) return card;
  }
  return null;
}

function isWebUrlWithHost(token: string): boolean {
  try {
    const u = new URL(token);
    return !!u.hostname && (u.protocol === 'http:' || u.protocol === 'https:');
  } catch {
    return false;
  }
}

function isGenericLink(token: string): boolean {
  if (!/^https?:\/\//i.test(token)) return false;
  if (specificCard(token)) return false;
  return isWebUrlWithHost(token);
}

function classify(token: string): CardLink | null {
  const card = specificCard(token);
  if (card) return card;
  const clean = token.replace(/[.,;:!?)\]}'"]+$/, '');
  return isGenericLink(clean) ? { kind: 'generic', url: clean } : null;
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
