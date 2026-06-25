import type {
  ActionConfig,
  Alignment,
  BadgeColorValue,
  BadgeSize,
  BadgeVariant,
  BorderValue,
  ButtonColorValue,
  ButtonIconSize,
  ButtonStyle,
  CaptionSize,
  CardAction,
  CardSize,
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
  PopoverItem,
  PositionFields,
  RadiusValue,
  SpacingValue,
  TextAlign,
  TextSize,
  Theme,
  TitleSize,
  WidgetStatus,
} from './node-fields';
import type {
  CheckboxNode,
  ColorPickerNode,
  DatePickerNode,
  InputNode,
  RadioGroupNode,
  SelectNode,
  SwitchNode,
  TabsNode,
  TextareaNode,
  TextFieldNode,
} from './nodes-controls';

export type {
  CheckboxNode,
  ColorPickerNode,
  DatePickerNode,
  InputNode,
  RadioGroupNode,
  SelectionRange,
  SelectNode,
  SwitchNode,
  TabsNode,
  TabsOption,
  TextareaNode,
  TextFieldNode,
} from './nodes-controls';

import type {
  AudioPlayerNode,
  AvatarStackNode,
  FilePickerNode,
  QRCodeNode,
  SpinnerNode,
  VideoPlayerNode,
} from './nodes-extensions';

export type {
  AudioPlayerNode,
  AvatarStackItem,
  AvatarStackNode,
  FilePickerMediaType,
  FilePickerNode,
  FilePickerSource,
  QRCodeNode,
  SpinnerNode,
  VideoPlayerNode,
} from './nodes-extensions';

export type { NodeBase };

export interface BoxLayoutBase extends NodeBase, PositionFields {
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
  background?: Color;
  lineHeight?: number;
  fontSize?: number;
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
  size?: IconSize | number;
}

export interface BadgeNode extends NodeBase {
  type: 'Badge';
  label: string;
  color?: BadgeColorValue;
  background?: BadgeColorValue;
  weight?: FontWeight;
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
  color?: ButtonColorValue;
  background?: Color;
  pressedBackground?: Color;
  foreground?: Color;
  radius?: RadiusValue;
  variant?: ControlVariant;
  size?: ControlSize;
  pill?: boolean;
  uniform?: boolean;
  block?: boolean;
  disabled?: boolean;
  paddingX?: Dimension;
  paddingY?: Dimension;
  fontFamily?: string;
  fontSize?: number;
  iconPx?: number;
}

export interface ListViewItemNode extends NodeBase {
  type: 'ListViewItem';
  children: WidgetNode[];
  onClickAction?: ActionConfig;
  onLongPressAction?: ActionConfig;
  onSwipeAction?: ActionConfig;
  gap?: Dimension;
  align?: Alignment;
  padding?: SpacingValue;
  paddingX?: Dimension;
  paddingY?: Dimension;
  border?: BorderValue;
  pressedBackground?: Color;
  pressedBorderColor?: Color;
  showDivider?: boolean;
}

export interface StackNode extends NodeBase {
  type: 'Stack';
  children: WidgetNode[];
  width?: Dimension;
  height?: Dimension;
  size?: Dimension;
  align?: Alignment;
  justify?: Justification;
}

export interface ScrollRowNode extends NodeBase {
  type: 'ScrollRow';
  children: WidgetNode[];
  gap?: Dimension;
  padding?: SpacingValue;
}

export interface PressableNode extends NodeBase {
  type: 'Pressable';
  children: WidgetNode[];
  onClickAction?: ActionConfig;
  onLongPressAction?: ActionConfig;
  onSwipeAction?: ActionConfig;
  hitSlop?: number;
}

export interface TransitionNode extends NodeBase {
  type: 'Transition';
  children?: WidgetNode;
}

import type { ChartNode } from './chart-node';
export type { ChartNode } from './chart-node';
export interface PopoverNode extends NodeBase {
  type: 'Popover';
  trigger: WidgetNode;
  items: PopoverItem[];
  side?: 'top' | 'bottom';
  align?: 'start' | 'end';
  title?: string;
}

export interface VoiceRecorderNode extends NodeBase {
  type: 'VoiceRecorder';
  recording: boolean;
  levels?: number[];
  recordSecs?: number;
  slideToCancel?: number;
  fg: Color;
  head: Color;
  sub: Color;
  bg: Color;
  chipBg: Color;
  primary: Color;
  inputSlot: WidgetNode;
  leftControls: WidgetNode;
  rightAction?: WidgetNode;
  onStartAction?: ActionConfig;
  onCancelAction?: ActionConfig;
  onCompleteAction?: ActionConfig;
}

export interface UnknownNode extends NodeBase {
  type: string;
  [extra: string]: unknown;
}

export type WidgetNode =
  | CardNode | ListViewNode | BasicNode | BoxNode | RowNode | ColNode
  | FormNode | SpacerNode | DividerNode | TextNode | TitleNode | CaptionNode
  | MarkdownNode | LabelNode | ImageNode | IconNode | BadgeNode | ButtonNode
  | InputNode | TextareaNode | SelectNode | CheckboxNode | RadioGroupNode
  | DatePickerNode | SwitchNode | TabsNode | TextFieldNode | ColorPickerNode
  | SpinnerNode | StackNode | ScrollRowNode | AvatarStackNode | QRCodeNode
  | AudioPlayerNode | VideoPlayerNode | FilePickerNode | PressableNode | PopoverNode
  | VoiceRecorderNode | ListViewItemNode | TransitionNode | ChartNode | UnknownNode;
export type WidgetRoot = CardNode | ListViewNode | BasicNode;
