import {
  hasChannelRef, splitChannelRefs, withChannelLabels, type ChannelRefSegment,
} from '@stage-labs/client/xmtp/channelRefs';
import { hasMention, parseMentions, type MentionSegment } from '@stage-labs/client/xmtp/mentions';

export type BodyView = 'plain' | 'namedPlain' | 'mention' | 'markdown';

export type BodySegment =
  | MentionSegment
  | Extract<ChannelRefSegment, { type: 'channel' }>
  | { type: 'link'; url: string; text: string };

interface LinkMatch { index: number; lastIndex: number; url: string }

export type LinkFinder = (text: string) => readonly LinkMatch[] | null;

interface Span { index: number; lastIndex: number; segment: BodySegment }

const MARKDOWN_LINK_RE = /\[([^[\]\n]+)\]\(((?:[^\s()]|\([^\s()]*\))+)\)/g;

export function mentionLabel(name: string): string {
  return name.startsWith('@') ? name : `@${name}`;
}

export function mentionAddresses(text: string): string[] {
  return parseMentions(text).flatMap(seg => (seg.type === 'mention' ? [seg.address] : []));
}

export function withMentionLabels(text: string, labelOf: (address: string) => string): string {
  return parseMentions(withChannelLabels(text)).map(seg => (seg.type === 'mention' ? labelOf(seg.address) : seg.text)).join('');
}

export function bodyView(body: string, plain: boolean): BodyView {
  const mentions = hasMention(body) || hasChannelRef(body);
  if (plain) return mentions ? 'namedPlain' : 'plain';
  return mentions ? 'mention' : 'markdown';
}

function splitSpans(text: string, spans: Span[], between: (text: string) => BodySegment[]): BodySegment[] {
  const out: BodySegment[] = [];
  let last = 0;
  for (const span of spans) {
    out.push(...between(text.slice(last, span.index)), span.segment);
    last = span.lastIndex;
  }
  return [...out, ...between(text.slice(last))];
}

function wholeLinkUrl(target: string, findLinks: LinkFinder): string | undefined {
  const [match, ...rest] = findLinks(target) ?? [];
  if (!match || rest.length > 0 || match.index !== 0 || match.lastIndex !== target.length) return undefined;
  return match.url;
}

function markdownLinkSpans(text: string, findLinks: LinkFinder): Span[] {
  return [...text.matchAll(MARKDOWN_LINK_RE)].flatMap<Span>(m => {
    const url = wholeLinkUrl(m[2] ?? '', findLinks);
    if (url === undefined) return [];
    return [{ index: m.index, lastIndex: m.index + m[0].length, segment: { type: 'link', url, text: m[1] ?? '' } }];
  });
}

function bareLinkSpans(text: string, findLinks: LinkFinder): Span[] {
  return (findLinks(text) ?? []).map((m): Span => ({
    index: m.index,
    lastIndex: m.lastIndex,
    segment: { type: 'link', url: m.url, text: text.slice(m.index, m.lastIndex) },
  }));
}

export function bodySegments(body: string, findLinks: LinkFinder): BodySegment[] {
  const withBareLinks = (text: string): BodySegment[] => splitSpans(text, bareLinkSpans(text, findLinks), parseMentions);
  return splitChannelRefs(body).flatMap<BodySegment>(seg => (
    seg.type === 'channel' ? [seg] : splitSpans(seg.text, markdownLinkSpans(seg.text, findLinks), withBareLinks)
  ));
}
