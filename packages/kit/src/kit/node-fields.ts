
export type TextSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type TitleSize =
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl'
  | '4xl'
  | '5xl'
  | '6xl'
  | '7xl';

export type CaptionSize = 'sm' | 'md' | 'lg';

export type IconSize =
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl';

export type ControlSize =
  | '3xs'
  | '2xs'
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl';

export type GutterSize = '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type FontWeight = 'normal' | 'medium' | 'semibold' | 'bold';

export type TextAlign = 'start' | 'center' | 'end';

export type Alignment = 'start' | 'center' | 'end' | 'baseline' | 'stretch';

export type Justification =
  | 'start'
  | 'center'
  | 'end'
  | 'between'
  | 'around'
  | 'evenly'
  | 'stretch';

export type FlexWrap = 'nowrap' | 'wrap' | 'wrap-reverse';

export type FlexDirection = 'row' | 'col';

export type ControlVariant = 'solid' | 'soft' | 'outline' | 'ghost';

export type FieldVariant = 'soft' | 'outline';

export type RadiusValue =
  | '2xs'
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl'
  | '4xl'
  | 'full'
  | '100%'
  | 'none';

export type CardSize = 'sm' | 'md' | 'lg' | 'full';

export type Theme = 'light' | 'dark';

export type BadgeColor =
  | 'secondary'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'discovery';

export type BadgeVariant = 'solid' | 'soft' | 'outline';

export type BadgeSize = '3xs' | '2xs' | 'sm' | 'md' | 'lg';

export type BadgeColorValue = Color;

export type TextFieldVariant = 'outline' | 'plain';

export type ReturnKeyType = 'done' | 'go' | 'next' | 'search' | 'send';

export type ButtonColor =
  | 'primary'
  | 'secondary'
  | 'info'
  | 'discovery'
  | 'success'
  | 'caution'
  | 'warning'
  | 'danger';

export type ButtonStyle = 'primary' | 'secondary';

export type ButtonColorValue = Color;

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

export type SpinnerSize = 'sm' | 'md' | 'lg';

export type TabsVariant = 'segmented' | 'underline';

export type ButtonIconSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export type ImageFit = 'cover' | 'contain' | 'fill' | 'scale-down' | 'none';

export type ImagePosition =
  | 'top left'
  | 'top'
  | 'top right'
  | 'left'
  | 'center'
  | 'right'
  | 'bottom left'
  | 'bottom'
  | 'bottom right';

export type InputType =
  | 'number'
  | 'email'
  | 'text'
  | 'password'
  | 'tel'
  | 'url';

export type BorderStyle =
  | 'solid'
  | 'dashed'
  | 'dotted'
  | 'double'
  | 'groove'
  | 'ridge'
  | 'inset'
  | 'outset';

export type PopoverSide = 'top' | 'bottom' | 'left' | 'right';

export type ActionHandler = 'server' | 'client';

export type LoadingBehavior = 'auto' | 'none' | 'self' | 'container';

export type CurveType =
  | 'basis'
  | 'basisClosed'
  | 'basisOpen'
  | 'bumpX'
  | 'bumpY'
  | 'bump'
  | 'linear'
  | 'linearClosed'
  | 'natural'
  | 'monotoneX'
  | 'monotoneY'
  | 'monotone'
  | 'step'
  | 'stepBefore'
  | 'stepAfter';

export type Dimension = number | string;

export interface ThemeColor {
  dark: string;
  light: string;
}

export type Color = string | ThemeColor;

export interface Spacing {
  top?: Dimension;
  right?: Dimension;
  bottom?: Dimension;
  left?: Dimension;
  x?: Dimension;
  y?: Dimension;
}

export type SpacingValue = number | string | Spacing;

export interface Border {
  size?: Dimension;
  color?: Color;
  style?: BorderStyle;
}

export type BorderSide = number | Border;

export interface Borders {
  top?: BorderSide;
  right?: BorderSide;
  bottom?: BorderSide;
  left?: BorderSide;
  x?: BorderSide;
  y?: BorderSide;
}

export type BorderValue = number | Border | Borders;

export interface ActionConfig {
  type: string;
  payload?: unknown;
  handler?: ActionHandler;
  loadingBehavior?: LoadingBehavior;
  streaming?: boolean;
}

export interface CardAction {
  label: string;
  action: ActionConfig;
}

export interface WidgetStatusWithFavicon {
  text: string;
  favicon?: string;
  frame?: boolean;
}

export interface WidgetStatusWithIcon {
  text: string;
  icon?: string;
}

export type WidgetStatus = WidgetStatusWithFavicon | WidgetStatusWithIcon;

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
}

export interface RadioOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface EditableProps {
  name?: string;
  placeholder?: string;
  required?: boolean;
  pattern?: string;
  autoFocus?: boolean;
  autoSelect?: boolean;
  autoComplete?: string;
  allowAutofillExtensions?: boolean;
}

export interface XAxisConfig {
  dataKey: string;
  hide?: boolean;
  labels?: Record<string, string>;
}

export type ChartDataRow = Record<string, unknown>;

export interface ChartSeriesBar {
  type: 'bar';
  dataKey: string;
  label?: string;
  stack?: string;
  color?: Color;
}

export interface ChartSeriesLine {
  type: 'line';
  dataKey: string;
  label?: string;
  color?: Color;
  curveType?: CurveType;
}

export interface ChartSeriesArea {
  type: 'area';
  dataKey: string;
  label?: string;
  stack?: string;
  color?: Color;
  curveType?: CurveType;
}

export type ChartSeries = ChartSeriesBar | ChartSeriesLine | ChartSeriesArea;

export type Position = 'absolute' | 'relative';

export interface PositionFields {
  position?: Position;
  top?: Dimension;
  right?: Dimension;
  bottom?: Dimension;
  left?: Dimension;
  inset?: Dimension;
  zIndex?: number;
}

export interface NodeBase {
  id?: string;
  key?: string;
}
