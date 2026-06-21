import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
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

export type MarkdownProps = Pick<ComponentProps<typeof Markdown>, 'markdownit' | 'onLinkPress' | 'style'>;

function BubbleAttachment({ att, index, entryId, fg, sub, dark }: {
  att: Attachment; index: number; entryId: string; fg: string; sub: string; dark: boolean;
}): React.ReactElement {
  const key = att.id ?? `${entryId}-att-${index}`;
  if (att.remote) {
    return <RemoteAttachmentResolver key={key} att={att} fg={fg} sub={sub} dark={dark} msgId={entryId} index={index} />;
  }
  const fullUrl = att.dataB64
    ? `data:${att.mime ?? 'application/octet-stream'};base64,${att.dataB64}`
    : att.url ?? '';
  return <AttachmentView key={key} att={att} fg={fg} fullUrl={fullUrl} dark={dark} />;
}

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

function BubbleBodyText({ body, fg, dark, selectable, highlight, markdownProps }: {
  body: string; fg: string; dark: boolean; selectable?: boolean;
  highlight?: string; markdownProps: MarkdownProps;
}): React.ReactElement {
  if (highlight?.trim()) return <HighlightText text={body} query={highlight} fg={fg} />;
  if (selectable) return <Text size="3xl" selectable color={fg} style={{ lineHeight: 23 }}>{body}</Text>;
  if (hasMention(body)) return <MentionBody text={body} fg={fg} dark={dark} />;
  return <Markdown {...markdownProps}>{body}</Markdown>;
}

export function BubbleBody({ text, fg, dark, selectable, highlight, markdownProps }: {
  text: string; fg: string; dark: boolean; selectable?: boolean;
  highlight?: string; markdownProps: MarkdownProps;
}): React.ReactElement {
  const body = unescapeBody(text);
  return (
    <Box style={{ alignSelf: 'stretch' }}>
      <BubbleBodyText body={body} fg={fg} dark={dark} selectable={selectable} highlight={highlight} markdownProps={markdownProps} />
    </Box>
  );
}

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

export function TranscriptLine({ transcript, atts, entryTs, sub }: {
  transcript?: string; atts: Attachment[]; entryTs: string; sub: string;
}): React.ReactElement | null {
  if (transcript) {
    return (
      <Text size="xs" color={sub} style={{ opacity: 0.85, fontStyle: 'italic', marginTop: atts.length ? 4 : 0 }}>“{transcript}”</Text>
    );
  }
  const transcribing = atts.some(a => a.kind === 'audio') && Date.now() - new Date(entryTs).getTime() < 30_000;
  if (!transcribing) return null;
  return (
    <Text size="xs" color={sub} style={{ opacity: 0.6, fontStyle: 'italic', marginTop: 4 }}>
      transcribing…
    </Text>
  );
}
