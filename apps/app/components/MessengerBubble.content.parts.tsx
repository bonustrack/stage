/** @file Sub-blocks of BubbleContent: attachments, body text, embed cards, and the interactive cards. */
import { Pressable } from '@stage-labs/kit/pressable';
import { Text } from '@stage-labs/kit/text';
import Markdown from 'react-native-markdown-display';
import { YouTubeEmbed, LocationEmbed } from './MediaEmbeds';
import { ChannelCard } from './ChannelCard';
import { GitHubLinkCard } from './GitHubLinkCard';
import { PreviewLinkCard } from './PreviewLinkCard';
import { LinkPreviewCard } from './LinkPreviewCard';
import type { CardLink } from '../lib/cardLinks';
import type { ComponentProps } from 'react';
import { Box } from './layout';
import { hasMention, unescapeBody } from './MessengerBubble.helpers';
import type { Attachment } from './MessengerBubble.helpers';
import { AttachmentView, RemoteAttachmentResolver } from './MessengerBubble.attachments';
import { MentionBody } from './MessengerBubble.parts';
import { HighlightText } from './HighlightText';

/** Props shared by the markdown renderers (parser, link handler, style). */
export type MarkdownProps = Pick<ComponentProps<typeof Markdown>, 'markdownit' | 'onLinkPress' | 'style'>;

/** Renders one attachment (remote resolver, inline data URI, or url), keyed per index. */
function BubbleAttachment({ att, index, entryId, fg, sub, dark }: {
  att: Attachment; index: number; entryId: string; fg: string; sub: string; dark: boolean;
}): React.ReactElement {
  const key = att.id ?? `${entryId}-att-${index}`;
  /** Multi-remote attachments carry encrypted bytes on IPFS — resolve lazily. */
  if (att.remote) {
    return <RemoteAttachmentResolver key={key} att={att} fg={fg} sub={sub} dark={dark} msgId={entryId} index={index} />;
  }
  /** XMTP inline attachments carry bytes in `dataB64` (render via data: URI); otherwise use the url as-is. */
  const fullUrl = att.dataB64
    ? `data:${att.mime ?? 'application/octet-stream'};base64,${att.dataB64}`
    : att.url ?? '';
  return <AttachmentView key={key} att={att} fg={fg} fullUrl={fullUrl} dark={dark} />;
}

/** Renders the bubble's attachment column, or null when there are none. */
export function BubbleAttachments({ atts, entryId, fg, sub, dark }: {
  atts: Attachment[]; entryId: string; fg: string; sub: string; dark: boolean;
}): React.ReactElement | null {
  if (atts.length === 0) return null;
  return (
    <Box style={{ alignSelf: 'stretch' }}>
      {atts.map((a, i) => (
        <BubbleAttachment key={a.id ?? `${entryId}-att-${i}`} att={a} index={i} entryId={entryId} fg={fg} sub={sub} dark={dark} />
      ))}
    </Box>
  );
}

/** Picks the body renderer (highlight / selectable / mention / markdown) for a message body. */
function BubbleBodyText({ body, fg, dark, selectable, highlight, markdownProps }: {
  body: string; fg: string; dark: boolean; selectable?: boolean;
  highlight?: string; markdownProps: MarkdownProps;
}): React.ReactElement {
  if (highlight?.trim()) return <HighlightText text={body} query={highlight} fg={fg} />;
  if (selectable) return <Text size="3xl" selectable color={fg} style={{ lineHeight: 23 }}>{body}</Text>;
  if (hasMention(body)) return <MentionBody text={body} fg={fg} dark={dark} />;
  return <Markdown {...markdownProps}>{body}</Markdown>;
}

/** Renders the bubble body text block (repairs escaped breaks, picks the renderer). */
export function BubbleBody({ text, fg, dark, selectable, highlight, markdownProps }: {
  text: string; fg: string; dark: boolean; selectable?: boolean;
  highlight?: string; markdownProps: MarkdownProps;
}): React.ReactElement {
  /** Repair line breaks delivered as the literal 2-char `\n` (escaped by a JSON-stringifying sender) into real breaks; no-op fast path for normal messages. */
  const body = unescapeBody(text);
  return (
    <Box style={{ alignSelf: 'stretch' }}>
      <BubbleBodyText body={body} fg={fg} dark={dark} selectable={selectable} highlight={highlight} markdownProps={markdownProps} />
    </Box>
  );
}

/** Resolves the embed node for a single card link. */
function embedNode(card: CardLink, dark: boolean): React.ReactElement {
  switch (card.kind) {
    case 'dm': return <ChannelCard peerAddress={card.peerAddress} dark={dark} />;
    case 'channel': return <ChannelCard convId={card.convId} dark={dark} />;
    case 'youtube': return <YouTubeEmbed videoId={card.videoId} dark={dark} />;
    case 'map': return <LocationEmbed lat={card.lat} lng={card.lng} sourceUrl={card.sourceUrl} dark={dark} />;
    case 'github': return <GitHubLinkCard url={card.url} dark={dark} />;
    case 'preview': return <PreviewLinkCard url={card.url} dark={dark} />;
    default: return <LinkPreviewCard url={card.url} dark={dark} />;
  }
}

/** Renders the stacked inline embed cards (one per card-generating link in the body). */
export function BubbleEmbeds({ cardLinks, dark }: { cardLinks: CardLink[]; dark: boolean }): React.ReactElement {
  return (
    <>
      {cardLinks.map(card => (
        <Box key={`${card.kind}:${card.url}`} margin={{ top: 6 }} style={{ alignSelf: 'stretch' }}>
          {embedNode(card, dark)}
        </Box>
      ))}
    </>
  );
}

/** Renders the reply-preview quote block above the body, or null when absent. */
export function ReplyPreview({ preview, fg, sub, onPress }: {
  preview?: string; fg: string; sub: string; onPress?: () => void;
}): React.ReactElement | null {
  if (!preview) return null;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        alignSelf: 'stretch', borderLeftWidth: 2, borderLeftColor: sub,
        paddingLeft: 6, marginBottom: 4, opacity: pressed ? 0.45 : 0.7,
      })}
    >
      <Text size="xl" color={fg} numberOfLines={2}>{preview}</Text>
    </Pressable>
  );
}

/** Renders the transcription line under an audio bubble (final transcript or "transcribing…"). */
export function TranscriptLine({ transcript, atts, entryTs, sub }: {
  transcript?: string; atts: Attachment[]; entryTs: string; sub: string;
}): React.ReactElement | null {
  if (transcript) {
    return (
      <Text size="xs" color={sub} style={{ opacity: 0.85, fontStyle: 'italic', marginTop: atts.length ? 4 : 0 }}>“{transcript}”</Text>
    );
  }
  /** Fresh audio bubble + transcription still running; old audio gets nothing. */
  const transcribing = atts.some(a => a.kind === 'audio') && Date.now() - new Date(entryTs).getTime() < 30_000;
  if (!transcribing) return null;
  return (
    <Text size="xs" color={sub} style={{ opacity: 0.6, fontStyle: 'italic', marginTop: 4 }}>
      transcribing…
    </Text>
  );
}
