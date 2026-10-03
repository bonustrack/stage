import type { TextStyle } from 'react-native';
import { Divider } from '@stage-labs/kit/react-native/divider';
import { Image } from '@stage-labs/kit/react-native/image';
import { Text, type TextSizeToken } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import type { MailBlock, MailImageBlock, MailSpan, MailTextBlock } from '@stage-labs/client/mail/mailHtml';
import { openInBubbleLink } from '../../lib/safeOpenLink';
import { usePalette } from '../../lib/theme';
import { Box, Col, Row } from '../layout';
import { bubbleLinkProps } from '../bubble/linkProps';
import { MONO_FONT } from '../bubble/helpers';
import { useImageAspectRatio } from '../bubble/mediaAspect';

const HEADING_SIZES: Readonly<Record<number, TextSizeToken>> = { 1: '3xl', 2: '2xl', 3: 'xl', 4: 'lg', 5: 'md', 6: 'md' };
const QUOTE_INDENT = 12;
const BODY_SIZE: TextSizeToken = 'md';
const CODE_STYLE: TextStyle = { fontFamily: MONO_FONT };
const UNDERLINE_STYLE: TextStyle = { textDecorationLine: 'underline' };

function spanStyle(span: MailSpan): TextStyle | undefined {
  if (span.code === true) return CODE_STYLE;
  return span.underline === true || span.href !== undefined ? UNDERLINE_STYLE : undefined;
}

function MailSpanText({ span, size }: { span: MailSpan; size: TextSizeToken }): React.ReactElement {
  const { primary } = usePalette();
  const link = span.href === undefined ? {} : bubbleLinkProps(span.href, openInBubbleLink);
  return (
    <Text size={size} weight={span.bold === true ? 'semibold' : undefined} italic={span.italic}
      color={span.href === undefined ? 'link' : primary} style={spanStyle(span)} {...link}>
      {span.text}
    </Text>
  );
}

function MailTextView({ block }: { block: MailTextBlock }): React.ReactElement {
  const { border } = usePalette();
  const size = HEADING_SIZES[block.heading] ?? BODY_SIZE;
  const text = (
    <Text size={size} color="link" selectable style={block.pre ? CODE_STYLE : undefined}>
      {block.spans.map((span, i) => <MailSpanText key={i} span={span} size={size} />)}
    </Text>
  );
  const body = block.bullet === null ? text : (
    <Row gap={8} align="start">
      <Text value={block.bullet} size={size} color="secondary" />
      <Col flex={1} minWidth={0}>{text}</Col>
    </Row>
  );
  if (block.quote === 0) return body;
  return (
    <Box padding={{ left: QUOTE_INDENT * block.quote }} border={{ left: { width: 2, color: border } }}>
      {body}
    </Box>
  );
}

function MailImage({ block }: { block: MailImageBlock }): React.ReactElement {
  const natural = useImageAspectRatio(block.src);
  const declared = block.width !== null && block.height !== null ? block.width / block.height : null;
  return (
    <Image src={block.src} alt={block.alt} fit="contain" width="100%" maxWidth={block.width ?? undefined}
      aspectRatio={declared ?? natural.aspectRatio} onLoad={natural.onLoad} style={{ alignSelf: 'flex-start' }} />
  );
}

function MailBlockView({ block }: { block: MailBlock }): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  if (block.type === 'rule') return <Divider dark={dark} />;
  if (block.type === 'image') return <MailImage block={block} />;
  return <MailTextView block={block} />;
}

export function MailBlocks({ blocks }: { blocks: readonly MailBlock[] }): React.ReactElement {
  return (
    <Col gap={12}>
      {blocks.map((block, i) => <MailBlockView key={i} block={block} />)}
    </Col>
  );
}
