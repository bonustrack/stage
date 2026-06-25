
import type {
  ActionConfig,
  Alignment,
  BadgeColor,
  BadgeSize,
  BadgeVariant,
  BorderValue,
  ButtonColor,
  ButtonIconSize,
  ButtonStyle,
  CaptionSize,
  CardAction,
  CardSize,
  ChartDataRow,
  ChartSeries,
  Color,
  ControlSize,
  ControlVariant,
  Dimension,
  EditableProps,
  FlexDirection,
  FlexWrap,
  FontWeight,
  IconSize,
  ImageFit,
  ImagePosition,
  Justification,
  NodeBase,
  RadiusValue,
  SpacingValue,
  TextAlign,
  TextSize,
  Theme,
  TitleSize,
  WidgetStatus,
  XAxisConfig,
} from './node-fields';
import type {
  CheckboxNode,
  DatePickerNode,
  InputNode,
  RadioGroupNode,
  SelectNode,
  TextareaNode,
} from './nodes-controls';

export type {
  CheckboxNode,
  DatePickerNode,
  InputNode,
  RadioGroupNode,
  SelectNode,
  TextareaNode,
};

export type { NodeBase };

export interface BoxLayoutBase extends NodeBase {
  align?: Alignment;
  justify?: Justification;
  wrap?: FlexWrap;
  flex?: Dimension;
  gap?: Dimension;
  width?: Dimension;
  height?: Dimension;
  size?: Dimension;
  minWidth?: Dimension;
  minHeight?: Dimension;
  minSize?: Dimension;
  maxWidth?: Dimension;
  maxHeight?: Dimension;
  maxSize?: Dimension;
  padding?: SpacingValue;
  margin?: SpacingValue;
  border?: BorderValue;
  radius?: RadiusValue;
  background?: Color;
  aspectRatio?: Dimension;
}

export interface CardNode extends NodeBase {
  type: 'Card';
  children: WidgetNode[];
  asForm?: boolean;
  background?: Color;
  size?: CardSize;
  padding?: SpacingValue;
  status?: WidgetStatus;
  collapsed?: boolean;
  confirm?: CardAction;
  cancel?: CardAction;
  theme?: Theme;
}

export interface ListViewNode extends NodeBase {
  type: 'ListView';
  children: ListViewItemNode[];
  limit?: number | 'auto';
  status?: WidgetStatus;
  theme?: Theme;
}

export interface BasicNode extends NodeBase {
  type: 'Basic';
  children?: WidgetNode | WidgetNode[];
  [extra: string]: unknown;
}

export interface BoxNode extends BoxLayoutBase {
  type: 'Box';
  children?: WidgetNode[];
  direction?: FlexDirection;
}

export interface RowNode extends BoxLayoutBase {
  type: 'Row';
  children?: WidgetNode[];
}

export interface ColNode extends BoxLayoutBase {
  type: 'Col';
  children?: WidgetNode[];
}

export interface FormNode extends BoxLayoutBase {
  type: 'Form';
  children?: WidgetNode[];
  direction?: FlexDirection;
  onSubmitAction?: ActionConfig;
}

export interface SpacerNode extends NodeBase {
  type: 'Spacer';
  minSize?: Dimension;
}

export interface DividerNode extends NodeBase {
  type: 'Divider';
  color?: Color;
  size?: Dimension;
  spacing?: Dimension;
  flush?: boolean;
}

export interface TextNode extends NodeBase {
  type: 'Text';
  value: string;
  streaming?: boolean;
  italic?: boolean;
  lineThrough?: boolean;
  color?: Color;
  weight?: FontWeight;
  size?: TextSize;
  textAlign?: TextAlign;
  truncate?: boolean;
  minLines?: number;
  maxLines?: number;
  width?: Dimension;
  editable?: false | EditableProps;
}

export interface TitleNode extends NodeBase {
  type: 'Title';
  value: string;
  color?: Color;
  weight?: FontWeight;
  textAlign?: TextAlign;
  truncate?: boolean;
  maxLines?: number;
  size?: TitleSize;
}

export interface CaptionNode extends NodeBase {
  type: 'Caption';
  value: string;
  color?: Color;
  weight?: FontWeight;
  textAlign?: TextAlign;
  truncate?: boolean;
  maxLines?: number;
  size?: CaptionSize;
}

export interface MarkdownNode extends NodeBase {
  type: 'Markdown';
  value: string;
  streaming?: boolean;
}

export interface LabelNode extends NodeBase {
  type: 'Label';
  value: string;
  fieldName: string;
  size?: TextSize;
  weight?: FontWeight;
  textAlign?: TextAlign;
  color?: Color;
}

export interface ImageNode extends NodeBase {
  type: 'Image';
  src: string;
  alt?: string;
  fit?: ImageFit;
  position?: ImagePosition;
  radius?: RadiusValue;
  frame?: boolean;
  flush?: boolean;
  width?: Dimension;
  height?: Dimension;
  size?: Dimension;
  minWidth?: Dimension;
  minHeight?: Dimension;
  minSize?: Dimension;
  maxWidth?: Dimension;
  maxHeight?: Dimension;
  maxSize?: Dimension;
  margin?: SpacingValue;
  background?: Color;
  aspectRatio?: Dimension;
  flex?: Dimension;
}

export interface IconNode extends NodeBase {
  type: 'Icon';
  name: string;
  color?: Color;
  size?: IconSize;
}

export interface BadgeNode extends NodeBase {
  type: 'Badge';
  label: string;
  color?: BadgeColor;
  variant?: BadgeVariant;
  size?: BadgeSize;
  pill?: boolean;
}

export interface ButtonNode extends NodeBase {
  type: 'Button';
  label?: string;
  submit?: boolean;
  onClickAction?: ActionConfig;
  iconStart?: string;
  iconEnd?: string;
  style?: ButtonStyle;
  iconSize?: ButtonIconSize;
  color?: ButtonColor;
  variant?: ControlVariant;
  size?: ControlSize;
  pill?: boolean;
  uniform?: boolean;
  block?: boolean;
  disabled?: boolean;
}

export interface ListViewItemNode extends NodeBase {
  type: 'ListViewItem';
  children: WidgetNode[];
  onClickAction?: ActionConfig;
  gap?: Dimension;
  align?: Alignment;
}

export interface TransitionNode extends NodeBase {
  type: 'Transition';
  children?: WidgetNode;
}

export interface ChartNode extends NodeBase {
  type: 'Chart';
  data: ChartDataRow[];
  series: ChartSeries[];
  xAxis: string | XAxisConfig;
  showYAxis?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  barGap?: number;
  barCategoryGap?: number;
  flex?: Dimension;
  width?: Dimension;
  height?: Dimension;
  size?: Dimension;
  minWidth?: Dimension;
  minHeight?: Dimension;
  minSize?: Dimension;
  maxWidth?: Dimension;
  maxHeight?: Dimension;
  maxSize?: Dimension;
  aspectRatio?: Dimension;
}

export interface UnknownNode extends NodeBase {
  type: string;
  [extra: string]: unknown;
}

export type WidgetNode =
  | CardNode
  | ListViewNode
  | BasicNode
  | BoxNode
  | RowNode
  | ColNode
  | FormNode
  | SpacerNode
  | DividerNode
  | TextNode
  | TitleNode
  | CaptionNode
  | MarkdownNode
  | LabelNode
  | ImageNode
  | IconNode
  | BadgeNode
  | ButtonNode
  | InputNode
  | TextareaNode
  | SelectNode
  | CheckboxNode
  | RadioGroupNode
  | DatePickerNode
  | ListViewItemNode
  | TransitionNode
  | ChartNode
  | UnknownNode;

export type WidgetRoot = CardNode | ListViewNode | BasicNode;
