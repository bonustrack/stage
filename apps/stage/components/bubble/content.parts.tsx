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
import { MESSAGE_LINK_STYLE, mdParser, unescapeBody } from './helpers';
import type { Attachment } from './helpers';
import { AttachmentView, RemoteAttachmentResolver } from './attachments';
import { inlineAttachmentUrl } from './attachmentUri';
import { galleryKeyOf } from './imageGallery.model';
import { ATTACHMENT_MAX_WIDTH } from './imageBox.model';
import { HighlightText } from '../HighlightText';
import { useRouter } from 'expo-router';
import { shortAddress } from '../../modules/messaging';
import { usePeerProfiles, getPeerName } from '../../lib/peerProfiles';
import { conversationLinkOf, profileLinkOf } from '../../lib/links';
import { useEffectiveColorScheme } from '../../lib/theme';
import { MESSAGE_LINK_COLOR } from '../../lib/uiColors';
import {
  bodySegments, bodyView, mentionAddresses, mentionLabel, withMentionLabels, type BodySegment, type LinkFinder,
} from './mention.model';

function mentionDisplay(address: string): string {
  return mentionLabel(getPeerName(address) ?? shortAddress(address));
}

function MentionLink({ address, fg }: { address: string; fg: string }): React.ReactElement {
  const router = useRouter();
  usePeerProfiles([address]);
  return (
    <Text size="3xl" color={fg} style={MESSAGE_LINK_STYLE} accessibilityRole="link"
      onPress={() => { router.push(profileLinkOf(address)); }} role="link"
      suppressHighlighting>
      {mentionDisplay(address)}
    </Text>
  );
}

function ChannelRefLink({ convId, label, fg }: { convId: string; label: string; fg: string }): React.ReactElement {
  const router = useRouter();
  return (
    <Text size="3xl" color={fg} style={MESSAGE_LINK_STYLE} accessibilityRole="link"
      onPress={() => { router.push(conversationLinkOf(convId)); }} role="link"
      suppressHighlighting>
      {`#${label}`}
    </Text>
  );
}

export type MarkdownProps = Pick<ComponentProps<typeof Markdown>, 'markdownit' | 'onLinkPress' | 'style'>;

type LinkPress = MarkdownProps['onLinkPress'];

const findLinks: LinkFinder = text => mdParser.linkify.match(text);

function WebLink({ url, text, fg, onLinkPress }: {
  url: string; text: string; fg: string; onLinkPress: LinkPress;
}): React.ReactElement {
  return (
    <Text size="3xl" color={fg} style={MESSAGE_LINK_STYLE} accessibilityRole="link"
      onPress={() => { onLinkPress?.(url); }} suppressHighlighting>
      {text}
    </Text>
  );
}

function segmentNode(seg: BodySegment, i: number, fg: string, onLinkPress: LinkPress): React.ReactNode {
  if (seg.type === 'text') return seg.text;
  if (seg.type === 'link') return <WebLink key={`l${i}`} url={seg.url} text={seg.text} fg={fg} onLinkPress={onLinkPress} />;
  if (seg.type === 'channel') return <ChannelRefLink key={`c${i}`} convId={seg.convId} label={seg.label} fg={fg} />;
  return <MentionLink key={`m${i}`} address={seg.address} fg={fg} />;
}

function MentionBody({ text, fg, onLinkPress }: { text: string; fg: string; onLinkPress: LinkPress }): React.ReactElement {
  const link = MESSAGE_LINK_COLOR[useEffectiveColorScheme()];
  return (
    <Text size="3xl" color={fg} style={{ lineHeight: 23 }}>
      {bodySegments(text, findLinks).map((seg, i) => segmentNode(seg, i, link, onLinkPress))}
    </Text>
  );
}

function BubbleAttachment({ att, index, entryId, fg }: {
  att: Attachment; index: number; entryId: string; fg: string;
}): React.ReactElement {
  const galleryKey = galleryKeyOf(entryId, index);
  if (att.remote) {
    return <RemoteAttachmentResolver att={att} fg={fg} msgId={entryId} index={index} galleryKey={galleryKey} />;
  }
  return <AttachmentView att={att} fg={fg} fullUrl={inlineAttachmentUrl(att)} galleryKey={galleryKey} />;
}

export function BubbleAttachments({ atts, entryId, fg }: {
  atts: Attachment[]; entryId: string; fg: string;
}): React.ReactElement | null {
  if (atts.length === 0) return null;
  return (
    <Box margin={{ top: 4 }} maxWidth={ATTACHMENT_MAX_WIDTH} style={{ alignSelf: 'stretch' }}>
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

interface PlainBodyProps { body: string; fg: string; query?: string }

function PlainBody({ body, fg, query }: PlainBodyProps): React.ReactElement {
  if (query) return <HighlightText text={body} query={query} fg={fg} />;
  return <Text size="3xl" selectable color={fg} style={{ lineHeight: 23 }}>{body}</Text>;
}

function NamedPlainBody({ body, fg, query }: PlainBodyProps): React.ReactElement {
  usePeerProfiles(mentionAddresses(body));
  return <PlainBody body={withMentionLabels(body, mentionDisplay)} fg={fg} query={query} />;
}

function BubbleBodyText({ body, fg, selectable, highlight, markdownProps }: {
  body: string; fg: string; selectable?: boolean;
  highlight?: string; markdownProps: MarkdownProps;
}): React.ReactElement {
  const query = highlight?.trim() ? highlight : undefined;
  switch (bodyView(body, query !== undefined || selectable === true)) {
    case 'namedPlain': return <NamedPlainBody body={body} fg={fg} query={query} />;
    case 'plain': return <PlainBody body={body} fg={fg} query={query} />;
    case 'mention': return <MentionBody text={body} fg={fg} onLinkPress={markdownProps.onLinkPress} />;
    case 'markdown': return <SafeMarkdown body={body} fg={fg} markdownProps={markdownProps} />;
  }
}

export function BubbleBody({ text, fg, selectable, highlight, markdownProps }: {
  text: string; fg: string; selectable?: boolean;
  highlight?: string; markdownProps: MarkdownProps;
}): React.ReactElement {
  const body = unescapeBody(text);
  return (
    <Box style={{ alignSelf: 'stretch' }}>
      <BubbleBodyText body={body} fg={fg} selectable={selectable} highlight={highlight} markdownProps={markdownProps} />
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
        <Box key={`${card.kind}:${card.url}`} margin={{ top: 6 }} maxWidth={ATTACHMENT_MAX_WIDTH} style={{ alignSelf: 'stretch' }}>
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
        alignSelf: 'stretch', maxWidth: ATTACHMENT_MAX_WIDTH, borderLeftWidth: 2, borderLeftColor: sub,
        paddingLeft: 6, marginBottom: 4, opacity: pressed ? 0.45 : 0.7,
      })}
    >
      <Text size="xl" color={fg} numberOfLines={2}>{preview}</Text>
    </Pressable>
  );
}
