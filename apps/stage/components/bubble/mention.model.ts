import {
  hasChannelRef, splitChannelRefs, withChannelLabels, type ChannelRefSegment,
} from '@stage-labs/client/xmtp/channelRefs';
import { hasMention, parseMentions, type MentionSegment } from '@stage-labs/client/xmtp/mentions';

export type BodyView = 'plain' | 'namedPlain' | 'mention' | 'markdown';

export type BodySegment = MentionSegment | Extract<ChannelRefSegment, { type: 'channel' }>;

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

export function bodySegments(body: string): BodySegment[] {
  return splitChannelRefs(body).flatMap<BodySegment>(seg => (seg.type === 'channel' ? [seg] : parseMentions(seg.text)));
}
