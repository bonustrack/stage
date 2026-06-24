import type {
  BadgeNode,
  CaptionNode,
  CardNode,
  ColNode,
  IconNode,
  ImageNode,
  RowNode,
  TextNode,
  TitleNode,
  WidgetNode,
} from '@stage-labs/kit/chatkit';

type RowProps = Omit<RowNode, 'type' | 'children'>;
type ColProps = Omit<ColNode, 'type' | 'children'>;
type CardProps = Omit<CardNode, 'type' | 'children'>;
type TextProps = Omit<TextNode, 'type' | 'value'>;
type TitleProps = Omit<TitleNode, 'type' | 'value'>;
type CaptionProps = Omit<CaptionNode, 'type' | 'value'>;
type BadgeProps = Omit<BadgeNode, 'type' | 'label'>;
type ImageProps = Omit<ImageNode, 'type' | 'src'>;
type IconProps = Omit<IconNode, 'type' | 'name'>;

export function row(children: WidgetNode[], props: RowProps = {}): RowNode {
  return { type: 'Row', children, ...props };
}

export function col(children: WidgetNode[], props: ColProps = {}): ColNode {
  return { type: 'Col', children, ...props };
}

export function card(children: WidgetNode[], props: CardProps = {}): CardNode {
  return { type: 'Card', children, ...props };
}

export function text(value: string, props: TextProps = {}): TextNode {
  return { type: 'Text', value, ...props };
}

export function title(value: string, props: TitleProps = {}): TitleNode {
  return { type: 'Title', value, ...props };
}

export function caption(value: string, props: CaptionProps = {}): CaptionNode {
  return { type: 'Caption', value, ...props };
}

export function badge(label: string, props: BadgeProps = {}): BadgeNode {
  return { type: 'Badge', label, ...props };
}

export function image(src: string, props: ImageProps = {}): ImageNode {
  return { type: 'Image', src, ...props };
}

export function icon(name: string, props: IconProps = {}): IconNode {
  return { type: 'Icon', name, ...props };
}
