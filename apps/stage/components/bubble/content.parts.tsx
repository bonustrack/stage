import { Component } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import Markdown from 'react-native-markdown-display';
import { YouTubeEmbed, LocationEmbed } from '../MediaEmbeds';
import { ChannelCard } from '../ChannelCard';
import { GitHubLinkCard } from '../GitHubLinkCard';
import { PreviewLinkCard } from '../PreviewLinkCard';
import { LinkPreviewCard } from '../LinkPreviewCard';
import type { CardLink } from '../../lib/cardLinks';
import type { ComponentProps } from 'react';
import { Box } from '../layout';
import { hasMention, unescapeBody } from './helpers';
import type { Attachment } from './helpers';
import { AttachmentView, RemoteAttachmentResolver } from './attachments';
import { HighlightText } from '../HighlightText';
import { useRouter } from 'expo-router';
import { shortAddress } from '../../modules/messaging';
import { usePeerProfiles, getPeerName } from '../../lib/peerProfiles';
import { parseMentions } from '@stage-labs/client/xmtp/mentions';
import { profileLinkOf } from '../../lib/links';

function MentionLink({ address, dark }: { address: string; dark: boolean }): React.ReactElement {
  const router = useRouter();
  usePeerProfiles([address]);
  const display = getPeerName(address) ?? shortAddress(address);
  const linkColor = dark ? '#7aa2ff' : '#2f6feb';
  return (
    <Text weight="semibold"
      onPress={() => { router.push(profileLinkOf(address)); }} color={linkColor}
      suppressHighlighting>
      @{display}
    </Text>
  );
}

function MentionBody({ text, fg, dark }: { text: string; fg: string; dark: boolean }): React.ReactElement {
  return (
    <Text size="3xl" color={fg} style={{ lineHeight: 23 }}>
      {parseMentions(text).map((seg, i) => (
        seg.type === 'text' ? seg.text : <MentionLink key={`m${i}`} address={seg.address} dark={dark} />
      ))}
    </Text>
  );
}

export type MarkdownProps = Pick<ComponentProps<typeof Markdown>, 'markdownit' | 'onLinkPress' | 'style'>;

function BubbleAttachment({ att, index, entryId, fg }: {
  att: Attachment; index: number; entryId: string; fg: string;
}): React.ReactElement {
  if (att.remote) {
    return <RemoteAttachmentResolver att={att} fg={fg} msgId={entryId} index={index} />;
  }
  const fullUrl = att.dataB64
    ? `data:${att.mime ?? 'application/octet-stream'};base64,${att.dataB64}`
    : att.url ?? '';
  return <AttachmentView att={att} fg={fg} fullUrl={fullUrl} />;
}

export function BubbleAttachments({ atts, entryId, fg }: {
  atts: Attachment[]; entryId: string; fg: string;
}): React.ReactElement | null {
  if (atts.length === 0) return null;
  return (
    <Box style={{ alignSelf: 'stretch' }}>
      {atts.map((a, i) => (
        <BubbleAttachment key={a.id ?? `${entryId}-att-${i}`} att={a} index={i} entryId={entryId} fg={fg} />
      ))}
    </Box>
  );
}

interface SafeMarkdownProps { body: string; fg: string; markdownProps: MarkdownProps }
interface SafeMarkdownState { failed: boolean }

class SafeMarkdown extends Component<SafeMarkdownProps, SafeMarkdownState> {
  override state: SafeMarkdownState = { failed: false };

  static getDerivedStateFromError(): SafeMarkdownState {
    return { failed: true };
  }

  override componentDidUpdate(prev: SafeMarkdownProps): void {
    if (prev.body !== this.props.body && this.state.failed) this.setState({ failed: false });
  }

  override render(): React.ReactNode {
    const { body, fg, markdownProps } = this.props;
    if (this.state.failed) {
      return <Text size="3xl" selectable color={fg} style={{ lineHeight: 23 }}>{body}</Text>;
    }
    return <Markdown {...markdownProps}>{body}</Markdown>;
  }
}

function BubbleBodyText({ body, fg, dark, selectable, highlight, markdownProps }: {
  body: string; fg: string; dark: boolean; selectable?: boolean;
  highlight?: string; markdownProps: MarkdownProps;
}): React.ReactElement {
  if (highlight?.trim()) return <HighlightText text={body} query={highlight} fg={fg} />;
  if (selectable) return <Text size="3xl" selectable color={fg} style={{ lineHeight: 23 }}>{body}</Text>;
  if (hasMention(body)) return <MentionBody text={body} fg={fg} dark={dark} />;
  return <SafeMarkdown body={body} fg={fg} markdownProps={markdownProps} />;
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
    case 'dm': return <ChannelCard peerAddress={card.peerAddress} />;
    case 'channel': return <ChannelCard convId={card.convId} />;
    case 'youtube': return <YouTubeEmbed videoId={card.videoId} />;
    case 'map': return <LocationEmbed lat={card.lat} lng={card.lng} sourceUrl={card.sourceUrl} dark={dark} />;
    case 'github': return <GitHubLinkCard url={card.url} />;
    case 'preview': return <PreviewLinkCard url={card.url} />;
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
