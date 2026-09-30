import {
  hasChannelRef, splitChannelRefs, withChannelLabels,
} from '@stage-labs/client/xmtp/channelRefs';
import { hasMention, parseMentions, type MentionSegment } from '@stage-labs/client/xmtp/mentions';
import { stageChannelIdOf } from '@stage-labs/client/xmtp/line';
import { MARKDOWN_LINK_RE } from '../../lib/channelLinks';

export type BodyView = 'plain' | 'namedPlain' | 'mention' | 'markdown';

export type BodySegment =
  | MentionSegment
  | { type: 'channel'; convId: string; label?: string; url?: string }
  | { type: 'link'; url: string; text: string };

interface LinkMatch { index: number; lastIndex: number; url: string }

export type LinkFinder = (text: string) => readonly LinkMatch[] | null;

interface Span { index: number; lastIndex: number; segment: BodySegment }

export function mentionLabel(name: string): string {
  return name.startsWith('@') ? name : `@${name}`;
}

export function mentionAddresses(text: string): string[] {
  return parseMentions(text).flatMap(seg => (seg.type === 'mention' ? [seg.address] : []));
}

export function withMentionLabels(text: string, labelOf: (address: string) => string): string {
  return parseMentions(withChannelLabels(text)).map(seg => (seg.type === 'mention' ? labelOf(seg.address) : seg.text)).join('');
}

export function bodyView(body: string, plain: boolean, findLinks?: LinkFinder): BodyView {
  const mentions = hasMention(body) || hasChannelRef(body);
  const channels = plain && findLinks && bodySegments(body, findLinks).some(s => s.type === 'channel');
  if (plain) return mentions || channels ? 'namedPlain' : 'plain';
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

function linkSegment(url: string, text: string): BodySegment {
  const convId = stageChannelIdOf(url);
  return convId ? {
    type: 'channel', convId, url, ...(text.startsWith('#') ? { label: text.slice(1) } : {}),
  } : { type: 'link', url, text };
}

function markdownLinkSpans(text: string, findLinks: LinkFinder): Span[] {
  return [...text.matchAll(MARKDOWN_LINK_RE)].flatMap<Span>(m => {
    const url = wholeLinkUrl(m[2] ?? '', findLinks);
    if (url === undefined) return [];
    return [{ index: m.index, lastIndex: m.index + m[0].length, segment: linkSegment(url, m[1] ?? '') }];
  });
}

function bareLinkSpans(text: string, findLinks: LinkFinder): Span[] {
  return (findLinks(text) ?? []).map((m): Span => {
    const clean = m.url.replace(/[.,;:!?)\]}'"`>]+$/, '');
    const url = stageChannelIdOf(clean) ? clean : m.url;
    const lastIndex = m.lastIndex - (m.url.length - url.length);
    return { index: m.index, lastIndex, segment: linkSegment(url, text.slice(m.index, lastIndex)) };
  });
}

export function bodySegments(body: string, findLinks: LinkFinder): BodySegment[] {
  const withBareLinks = (text: string): BodySegment[] => splitSpans(text, bareLinkSpans(text, findLinks), parseMentions);
  const prose = (text: string): BodySegment[] => splitChannelRefs(text).flatMap<BodySegment>(seg => (
    seg.type === 'channel' ? [seg] : splitSpans(seg.text, markdownLinkSpans(seg.text, findLinks), withBareLinks)
  ));
  const code = [...body.matchAll(/```[\s\S]*?```|`[^`\n]*`/g)].map((m): Span => ({
    index: m.index, lastIndex: m.index + m[0].length, segment: { type: 'text', text: m[0] },
  }));
  return splitSpans(body, code, prose);
}
