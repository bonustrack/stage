import { Component, cloneElement, isValidElement, useMemo } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import Markdown, { renderRules, type RenderRules } from 'react-native-markdown-display';
import { YouTubeEmbed, LocationEmbed } from '../MediaEmbeds';
import { ChannelCard } from '../ChannelCard';
import { GitHubLinkCard } from '../GitHubLinkCard';
import { PreviewLinkCard } from '../PreviewLinkCard';
import { LinkPreviewCard } from '../LinkPreviewCard';
import type { CardLink } from '../../lib/cardLinks';
import type { ComponentProps } from 'react';
import type { ViewStyle } from 'react-native';
import { Box, Row } from '../layout';
import { BLOCK_GAP, MESSAGE_LINK_STYLE, mdParser, unescapeBody } from './helpers';
import type { Attachment, LinkPress } from './helpers';
import { bubbleLinkProps } from './linkProps';
import { AttachmentView, RemoteAttachmentResolver } from './attachments';
import { inlineAttachmentUrl } from './attachmentUri';
import { galleryKeyOf } from './imageGallery.model';
import { ATTACHMENT_GRID_GAP, ATTACHMENT_MAX_WIDTH, attachmentCellWidths } from './imageBox.model';
import { resolvedAttachmentKind } from './attachmentKind.model';
import { HighlightText } from '../HighlightText';
import { CodeBlock } from './CodeBlock';
import { splitCodeBlocks } from './codeBlock.model';
import { taskStateOf } from './markdown.model';
import { TaskMark } from './TaskMark';
import { useRouter } from 'expo-router';
import { shortAddress } from '../../modules/messaging';
import { usePeerProfiles, getPeerName } from '../../lib/peerProfiles';
import { profileLinkOf } from '../../lib/links';
import { stageChannelIdOf } from '@stage-labs/client/xmtp/line';
import { ChannelLink, useChannelLinkNames } from './ChannelLink';
import { channelFallbackLabel, channelLinkText, markdownLabelText } from '../../lib/channelLinks';
import { useEffectiveColorScheme } from '../../lib/theme';
import { MESSAGE_LINK_COLOR } from '../../lib/uiColors';
import {
  bodySegments, bodyView, mentionAddresses, mentionLabel, namedPlainText, type BodySegment, type LinkFinder,
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

export type MarkdownProps = Pick<ComponentProps<typeof Markdown>, 'markdownit' | 'onLinkPress' | 'rules' | 'style'>;

type MarkdownViewStyles = Readonly<Record<string, ViewStyle | undefined>>;

const LAST_ROW = { borderBottomWidth: 0 } as const;

export const markdownRules: RenderRules = {
  link: (node, children, parents, styles, onLinkPress) => {
    const link = renderRules.link?.(node, children, parents, styles, onLinkPress);
    const href: unknown = node.attributes.href;
    if (!isValidElement<ComponentProps<typeof Text>>(link) || typeof href !== 'string') return link;
    const convId = stageChannelIdOf(href);
    if (convId) {
      const label = markdownLabelText(node);
      return <ChannelLink key={node.key} convId={convId} url={href} text={label} element={link}
        label={channelFallbackLabel(label)} onLinkPress={onLinkPress} />;
    }
    return cloneElement(link, bubbleLinkProps(href, onLinkPress));
  },
  list_item: (node, children, parents, styles: MarkdownViewStyles, inheritedStyles) => {
    const task = taskStateOf(node.attributes);
    if (!task) return renderRules.list_item?.(node, children, parents, styles, inheritedStyles);
    return (
      <Box key={node.key} style={styles._VIEW_SAFE_list_item}>
        <TaskMark task={task}/>
        <Box style={styles._VIEW_SAFE_bullet_list_content}>{children}</Box>
      </Box>
    );
  },
  tr: (node, children, parents, styles: MarkdownViewStyles) => {
    const body = parents[0];
    const last = body?.type === 'tbody' && node.index === body.children.length - 1;
    return <Box key={node.key} style={[styles._VIEW_SAFE_tr, last && LAST_ROW]}>{children}</Box>;
  },
};

const findLinks: LinkFinder = text => mdParser.linkify.match(text);

function WebLink({ url, text, fg, onLinkPress }: {
  url: string; text: string; fg: string; onLinkPress: LinkPress;
}): React.ReactElement {
  return (
    <Text size="3xl" color={fg} style={MESSAGE_LINK_STYLE} accessibilityRole="link"
      {...bubbleLinkProps(url, onLinkPress)} suppressHighlighting>
      {text}
    </Text>
  );
}

function segmentNode(seg: BodySegment, i: number, fg: string, onLinkPress: LinkPress): React.ReactNode {
  if (seg.type === 'text') return seg.text;
  if (seg.type === 'link') return <WebLink key={`l${i}`} url={seg.url} text={seg.text} fg={fg} onLinkPress={onLinkPress} />;
  if (seg.type === 'channel') return <ChannelLink key={`c${i}`} {...seg} fg={fg} onLinkPress={onLinkPress} />;
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
  const widths = useMemo(() => attachmentCellWidths(atts.map(resolvedAttachmentKind)), [atts]);
  if (atts.length === 0) return null;
  return (
    <Box margin={{ top: 4, bottom: 6 }} maxWidth={ATTACHMENT_MAX_WIDTH} style={{ alignSelf: 'stretch' }}>
      <Row wrap margin={-ATTACHMENT_GRID_GAP / 2}>
        {atts.map((a, i) => (
          <Box key={a.id ?? `${entryId}-att-${i}`} width={widths[i]} padding={ATTACHMENT_GRID_GAP / 2}>
            <BubbleAttachment att={a} index={i} entryId={entryId} fg={fg} />
          </Box>
        ))}
      </Row>
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
  const segments = bodySegments(body, findLinks, true);
  const convIds = [...new Set(segments.flatMap(seg => seg.type === 'channel' ? [seg.convId] : []))];
  const names = useChannelLinkNames(convIds);
  const text = namedPlainText(segments, mentionDisplay, seg => {
    const meta = names.get(seg.convId);
    return channelLinkText(meta ?? {}, seg.label, seg.url, meta?.peerAddr ? seg.raw ?? seg.text : seg.text);
  });
  return <PlainBody body={text} fg={fg} query={query} />;
}

function BubbleBodyText({ body, fg, selectable, highlight, markdownProps }: {
  body: string; fg: string; selectable?: boolean;
  highlight?: string; markdownProps: MarkdownProps;
}): React.ReactElement {
  const query = highlight?.trim() ? highlight : undefined;
  switch (bodyView(body, query !== undefined || selectable === true, findLinks)) {
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
  const parts = useMemo(() => splitCodeBlocks(unescapeBody(text)), [text]);
  return (
    <Box gap={BLOCK_GAP} style={{ alignSelf: 'stretch' }}>
      {parts.map((part, index) => (part.type === 'code' ? (
        <CodeBlock key={`code-${index}`} code={part.code} lang={part.lang} fg={fg} selectable={selectable} highlight={highlight} />
      ) : (
        <BubbleBodyText
          key={`text-${index}`} body={part.text} fg={fg} selectable={selectable}
          highlight={highlight} markdownProps={markdownProps}
        />
      )))}
    </Box>
  );
}

function embedNode(card: CardLink, dark: boolean): React.ReactElement {
  switch (card.kind) {
    case 'dm': return <ChannelCard peerAddress={card.peerAddress} url={card.url} />;
    case 'channel': return <ChannelCard convId={card.convId} url={card.url} />;
    case 'youtube': return <YouTubeEmbed videoId={card.videoId} />;
    case 'map': return <LocationEmbed lat={card.lat} lng={card.lng} dark={dark} />;
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
