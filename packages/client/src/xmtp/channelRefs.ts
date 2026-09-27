import { shareUrlFor } from '../routing/handles';

export interface ChannelRef {
  index: number;
  wire: string;
  label: string;
  convId: string;
}

export type ChannelRefSegment =
  | { type: 'text'; text: string }
  | { type: 'channel'; convId: string; label: string };

const CHANNEL_URL_PREFIX = shareUrlFor('/channel/');

const ESCAPED_PREFIX = CHANNEL_URL_PREFIX.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

const CHANNEL_REF_RE = new RegExp(`\\[#([^\\]\\n]+)\\]\\(${ESCAPED_PREFIX}([^\\s/?#()]+)\\)`, 'g');

export function channelRefLabel(name: string): string {
  const label = name.replace(/[[\]()]/g, '').replace(/\s+/g, ' ').trim().replace(/^#+\s*/, '');
  return label === '' ? 'channel' : label;
}

export function channelRefToken(convId: string, name: string): string {
  return `[#${channelRefLabel(name)}](${CHANNEL_URL_PREFIX}${convId})`;
}

export function channelRefsOf(text: string): ChannelRef[] {
  return [...text.matchAll(CHANNEL_REF_RE)].map(m => ({
    index: m.index,
    wire: m[0],
    label: m[1] ?? '',
    convId: m[2] ?? '',
  }));
}

export function hasChannelRef(text: string): boolean {
  return channelRefsOf(text).length > 0;
}

export function splitChannelRefs(text: string): ChannelRefSegment[] {
  const segments: ChannelRefSegment[] = [];
  let last = 0;
  for (const ref of channelRefsOf(text)) {
    if (ref.index > last) segments.push({ type: 'text', text: text.slice(last, ref.index) });
    segments.push({ type: 'channel', convId: ref.convId, label: ref.label });
    last = ref.index + ref.wire.length;
  }
  if (last < text.length) segments.push({ type: 'text', text: text.slice(last) });
  return segments;
}

export function withChannelLabels(text: string): string {
  return text.replace(CHANNEL_REF_RE, (_m, label: string) => `#${label}`);
}
