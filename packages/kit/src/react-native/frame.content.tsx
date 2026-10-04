import { cloneElement, isValidElement, useMemo, useState } from 'react';
import { Platform, Text as RNText, View, type DimensionValue, type TextProps, type ViewStyle } from 'react-native';
import RNMarkdown, { MarkdownIt, renderRules, type RenderRules } from 'react-native-markdown-display';
import { frameFlex, type FrameIconName, type FrameNodeOf } from '../frame';
import { frameBlockSize } from '../frame.flow';
import { httpsUrl } from '../frame.values';
import { NEW_TAB, isPlainClick, type LinkClickEvent } from '../link';
import { resolveColors, SIZES, textLabelStyle, type ButtonColor, type ButtonControlVariant } from '../button.styles';
import { spacingEntries } from '../layout';
import { markdownStyles } from '../markdown.styles';
import { TEXT_ALIGN_MAP, TEXT_FONTS } from '../text.styles';
import { DENSITY_SCALE, FONT_SIZE, FONT_SIZE_DEFAULT, fontSize, schemePalette } from '../tokens';
import { Badge } from './badge';
import { Button } from './button';
import { Caption } from './caption';
import { Glyph } from './glyph';
import { Image } from './image';
import { Label } from './label';
import { Text } from './text';
import { Title } from './title';
import { FRAME_ICON_GLYPHS } from './frame-icons';
import { controlSize, FrameTextField } from './frame.controls';
import { useFormScope, useFrameColor, useFrameRuntime } from './frame.runtime';

const markdownParser = MarkdownIt({ html: false, linkify: true, typographer: false }).disable(['image']);

interface WebLinkProps {
  href: string;
  hrefAttrs: typeof NEW_TAB;
  onPress: (event?: LinkClickEvent) => void;
}

const WEB_LINK_RULES: RenderRules = {
  link: (node, children, parents, styles, onLinkPress) => {
    const link = renderRules.link?.(node, children, parents, styles, onLinkPress);
    const href = httpsUrl(node.attributes.href);
    if (!isValidElement<TextProps>(link) || href === undefined) return link;
    const props: WebLinkProps = {
      href,
      hrefAttrs: NEW_TAB,
      onPress: (event) => {
        if (!isPlainClick(event)) return;
        event?.preventDefault();
        onLinkPress?.(href);
      },
    };
    return cloneElement(link, props);
  },
};

export function FrameText({ node }: { node: FrameNodeOf<'Text'> }): React.ReactElement {
  const color = useFrameColor();
  const { value, editable, size, weight, textAlign, italic, lineThrough, truncate, maxLines, width } = node.props;
  if (editable !== undefined) {
    return <FrameTextField name={editable.name} value={value} placeholder={editable.placeholder} required={editable.required} />;
  }
  return (
    <Text value={value} size={size} weight={weight} color={color(node.props.color)} textAlign={textAlign}
      italic={italic} lineThrough={lineThrough} truncate={truncate} maxLines={maxLines}
      style={width === undefined ? frameFlex(node) : [frameFlex(node), { width: width as DimensionValue }]} />
  );
}

export function FrameTitle({ node }: { node: FrameNodeOf<'Title'> }): React.ReactElement {
  const color = useFrameColor();
  const { value, size = FONT_SIZE_DEFAULT, weight, textAlign, truncate, maxLines } = node.props;
  const light = weight === 'normal' || weight === 'medium';
  return (
    <Title color={color(node.props.color)} numberOfLines={truncate === true ? 1 : maxLines}
      style={{
        ...frameFlex(node),
        fontSize: fontSize(size),
        ...(textAlign === undefined ? {} : { textAlign: TEXT_ALIGN_MAP[textAlign] }),
        ...(light ? { fontFamily: TEXT_FONTS[weight] } : {}),
      }}>
      {value}
    </Title>
  );
}

export function FrameCaption({ node }: { node: FrameNodeOf<'Caption'> }): React.ReactElement {
  const color = useFrameColor();
  const { value, size = FONT_SIZE_DEFAULT, weight, textAlign, truncate, maxLines } = node.props;
  return (
    <Caption value={value} weight={weight === 'bold' ? 'semibold' : weight}
      textAlign={textAlign} color={color(node.props.color)} truncate={truncate} maxLines={maxLines}
      style={[frameFlex(node), { fontSize: fontSize(size) }]} />
  );
}

export function FrameLabel({ node }: { node: FrameNodeOf<'Label'> }): React.ReactElement {
  const { dark } = useFrameRuntime();
  const color = useFrameColor();
  const { value, fieldName, size = FONT_SIZE_DEFAULT, weight, textAlign } = node.props;
  return (
    <Label value={value} fieldName={fieldName} weight={weight} textAlign={textAlign} color={color(node.props.color)}
      dark={dark} style={[frameFlex(node), { fontSize: fontSize(size) }]} />
  );
}

export function FrameMarkdown({ node }: { node: FrameNodeOf<'Markdown'> }): React.ReactElement {
  const { dark, openUrl } = useFrameRuntime();
  const styles = useMemo(() => markdownStyles({ fg: schemePalette(dark).head, dark, fontSize: fontSize(FONT_SIZE_DEFAULT) }), [dark]);
  return (
    <RNMarkdown markdownit={markdownParser} style={styles} rules={openUrl && Platform.OS === 'web' ? WEB_LINK_RULES : undefined} onLinkPress={(url) => {
      const safe = httpsUrl(url);
      if (safe !== undefined) openUrl?.(safe);
      return false;
    }}>
      {node.props.value ?? ''}
    </RNMarkdown>
  );
}

export function FrameBadge({ node }: { node: FrameNodeOf<'Badge'> }): React.ReactElement {
  const { dark } = useFrameRuntime();
  const { label = '', color, variant, size, pill } = node.props;
  return <Badge label={label} color={color} variant={variant} size={size} pill={pill} dark={dark} />;
}

export function FrameIcon({ node }: { node: FrameNodeOf<'Icon'> }): React.ReactElement | null {
  const { dark } = useFrameRuntime();
  const color = useFrameColor();
  const { name, size = FONT_SIZE_DEFAULT } = node.props;
  if (name === undefined) return null;
  return (
    <View style={frameFlex(node)}>
      <Glyph icon={FRAME_ICON_GLYPHS[name]} size={fontSize(size)} color={color(node.props.color)} dark={dark} />
    </View>
  );
}

export function FrameImage({ node }: { node: FrameNodeOf<'Image'> }): React.ReactElement | null {
  const color = useFrameColor();
  const { src, alt, fit, frame, flush, radius, size, width, height, aspectRatio, margin } = node.props;
  const { minWidth, maxWidth, minHeight, maxHeight } = frameBlockSize(node.props);
  const [failed, setFailed] = useState(false);
  if (src === undefined || failed) return null;
  const sized = size !== undefined || height !== undefined;
  return (
    <Image src={src} alt={alt} fit={fit} frame={frame} flush={flush} radius={radius} size={size}
      width={width ?? (size === undefined ? '100%' : undefined)} height={height}
      minWidth={minWidth} maxWidth={maxWidth} minHeight={minHeight} maxHeight={maxHeight}
      aspectRatio={aspectRatio ?? (sized ? undefined : 16 / 9)} background={color(node.props.background)}
      style={margin === undefined ? undefined : spacingEntries('margin', margin)}
      onError={() => { setFailed(true); }} />
  );
}

function iconNode(name: FrameIconName | undefined, color: string, size: number): React.ReactElement | undefined {
  return name === undefined ? undefined : <Glyph icon={FRAME_ICON_GLYPHS[name]} size={size} color={color} />;
}

const WRAPPING_LABEL = { flexShrink: 1 } as const;

function growingButtonStyle(height: number): ViewStyle {
  return { height: 'auto', minHeight: height, paddingVertical: DENSITY_SCALE.compact.paddingY };
}

export function FrameButton({ node }: { node: FrameNodeOf<'Button'> }): React.ReactElement {
  const { dark, usable } = useFrameRuntime();
  const scope = useFormScope();
  const [loading, setLoading] = useState(false);
  const { label, onClickAction, submit, iconStart, iconEnd, style, variant, size, pill, uniform, block, disabled } = node.props;
  const tone: ButtonColor = node.props.color ?? (style === 'secondary' ? 'secondary' : 'primary');
  const kind: ButtonControlVariant = variant ?? 'solid';
  const fg = resolveColors(tone, kind, dark).text;
  const acts = submit === true || onClickAction !== undefined;
  const press = async (): Promise<void> => {
    setLoading(true);
    try {
      await (submit === true ? scope?.submit({ label }) : scope?.run(onClickAction, { label }));
    } finally {
      setLoading(false);
    }
  };
  const control = controlSize(size) ?? 'md';
  const spec = SIZES[control];
  return (
    <Button label={label} color={tone} variant={kind} size={control} pill={pill} uniform={uniform} block={block}
      disabled={disabled === true || !acts || !usable(submit === true ? undefined : onClickAction)} loading={loading} dark={dark}
      iconStart={iconNode(iconStart, fg, FONT_SIZE.xs)} iconEnd={iconNode(iconEnd, fg, FONT_SIZE.xs)}
      style={growingButtonStyle(spec.height)}
      onPress={() => { void press(); }}>
      {label === undefined ? undefined : <RNText style={[textLabelStyle(spec, fg), WRAPPING_LABEL]}>{label}</RNText>}
    </Button>
  );
}
